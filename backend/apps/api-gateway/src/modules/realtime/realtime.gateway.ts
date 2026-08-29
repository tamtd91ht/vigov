import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@vigov/shared';
import {
  REALTIME_NAMESPACE,
  ROOM_DEPARTMENT,
  ROOM_ROLE,
  ROOM_USER,
  RealtimeService,
  departmentSlug,
} from './realtime.service';

/* ───────────────────────── Hằng số kênh WebSocket (P5-05) ───────────────────────── */

/** Giá trị CORS cho phép mọi nguồn (chỉ dùng ở môi trường phát triển) */
const CORS_ALLOW_ALL = '*';

/** Sự kiện báo lỗi xác thực gửi cho client ngay trước khi ngắt kết nối */
const EVENT_AUTH_ERROR = 'auth.error';

/**
 * Whitelist CORS của kênh realtime.
 *
 * Decorator @WebSocketGateway được đọc lúc nạp lớp nên không tiêm được ConfigService
 * vào đó. Cách làm: để `origin` là một HÀM — Socket.IO gọi hàm này mỗi lần bắt tay,
 * tức là sau khi constructor của gateway đã nạp cấu hình qua ConfigService.
 * Nhờ vậy vẫn giữ đúng quy tắc "không đọc process.env ngoài configuration.ts".
 */
let allowedOrigins: string[] = [];
let allowAllOrigins = true;

/** Bộ kiểm tra nguồn gọi cho Socket.IO (chạy mỗi lần client bắt tay) */
function realtimeCorsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  // Client không phải trình duyệt (app di động, script kiểm thử) không gửi Origin
  if (allowAllOrigins || !origin) return callback(null, true);
  callback(null, allowedOrigins.includes(origin));
}

/**
 * Cổng WebSocket thời gian thực (P5-05).
 *
 * PHẠM VI: realtime đầy đủ tới đâu là câu hỏi mở #7, chưa được khách chốt. Hiện chỉ
 * phục vụ 3 sự kiện trong REALTIME_EVENTS (feedback.changed, task.changed,
 * notification.new) — xem chú thích ở realtime.service.ts.
 *
 * Xác thực: dùng CHÍNH JWT của hệ thống, client gửi qua `handshake.auth.token`.
 * Không có token hoặc token sai → ngắt kết nối ngay, không mở phòng nào.
 */
@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  cors: {
    origin: realtimeCorsOrigin,
    credentials: false,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
  ) {
    // Nạp whitelist CORS một lần lúc khởi tạo — hàm realtimeCorsOrigin đọc lại ở mỗi lần bắt tay
    const raw = this.config.get<string>('security.corsOrigins') ?? CORS_ALLOW_ALL;
    allowedOrigins = raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    allowAllOrigins = allowedOrigins.length === 0 || allowedOrigins.includes(CORS_ALLOW_ALL);
  }

  afterInit(server: Server): void {
    // Trao máy chủ cho RealtimeService để các module nghiệp vụ phát sự kiện được
    this.realtime.bind(server);
    this.logger.log(
      `Kênh thời gian thực sẵn sàng tại ${REALTIME_NAMESPACE} ` +
        `(CORS: ${allowAllOrigins ? 'mọi nguồn — chỉ dùng khi phát triển' : allowedOrigins.join(', ')})`,
    );
  }

  /** Bắt tay: xác thực JWT rồi cho vào các phòng vai trò / bộ phận / cá nhân */
  async handleConnection(client: Socket): Promise<void> {
    const token = extractToken(client);
    if (!token) return this.reject(client, 'Thiếu mã xác thực');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      return this.reject(client, 'Mã xác thực không hợp lệ hoặc đã hết hạn');
    }

    // Lưu danh tính lên socket để dùng lại khi ngắt kết nối / gỡ lỗi
    client.data.user = payload;

    const rooms = buildRooms(payload);
    await client.join(rooms);

    this.logger.log(`${payload.username} (${payload.roleKey}) vào kênh realtime — phòng: ${rooms.join(', ')}`);
  }

  handleDisconnect(client: Socket): void {
    const user = client.data.user as JwtPayload | undefined;
    if (user) this.logger.debug(`${user.username} rời kênh realtime`);
  }

  /** Từ chối một kết nối: báo lý do rồi ngắt hẳn (không cho vào phòng nào) */
  private reject(client: Socket, reason: string): void {
    this.logger.warn(`Từ chối kết nối realtime ${client.id}: ${reason}`);
    client.emit(EVENT_AUTH_ERROR, { message: reason });
    client.disconnect(true);
  }
}

/* ─────────────────────────── Hàm thuần dùng chung ─────────────────────────── */

/**
 * Lấy token từ lần bắt tay.
 *
 * Ưu tiên `handshake.auth.token` (cách chuẩn của socket.io-client:
 * `io(url, { auth: { token } })`). Chấp nhận thêm header Authorization để các
 * client không đặt được `auth` (một số thư viện WebSocket thuần) vẫn dùng được.
 */
function extractToken(client: Socket): string | null {
  const fromAuth = (client.handshake.auth as { token?: unknown } | undefined)?.token;
  if (typeof fromAuth === 'string' && fromAuth.trim()) {
    return stripBearer(fromAuth.trim());
  }
  const header = client.handshake.headers.authorization;
  if (typeof header === 'string' && header.trim()) return stripBearer(header.trim());
  return null;
}

/** Bỏ tiền tố "Bearer " nếu client gửi kèm */
function stripBearer(value: string): string {
  return value.startsWith('Bearer ') ? value.slice(7) : value;
}

/**
 * Danh sách phòng của một tài khoản.
 * Công dân không có `department` nên chỉ vào phòng vai trò và phòng cá nhân.
 */
function buildRooms(payload: JwtPayload): string[] {
  const rooms = [`${ROOM_USER}${payload.username}`];
  if (payload.roleKey) rooms.push(`${ROOM_ROLE}${payload.roleKey}`);
  const slug = departmentSlug(payload.department);
  if (slug) rooms.push(`${ROOM_DEPARTMENT}${slug}`);
  return rooms;
}
