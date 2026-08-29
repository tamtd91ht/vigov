import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

/* ───────────────────────── Hằng số kênh thời gian thực (P5-05) ───────────────────────── */

/** Namespace Socket.IO — client kết nối tới ws(s)://<host>/realtime */
export const REALTIME_NAMESPACE = '/realtime';

/**
 * Danh sách sự kiện đẩy xuống client.
 *
 * PHẠM VI: câu hỏi mở #7 (realtime đầy đủ tới đâu) CHƯA được khách chốt. Phase này
 * chỉ làm 3 sự kiện chắc chắn cần, đủ để Web Quản trị tự làm mới danh sách mà không
 * phải hỏi lại máy chủ theo chu kỳ. Khi khách chốt thêm (văn bản đến, giải ngân,
 * bình luận nhiệm vụ...) thì bổ sung vào bảng này và gọi RealtimeService ở đúng chỗ
 * nghiệp vụ đã có sẵn — KHÔNG viết lại luồng nghiệp vụ.
 */
export const REALTIME_EVENTS = {
  /** Phiếu phản ánh: tạo mới / phân công / xử lý xong */
  FEEDBACK_CHANGED: 'feedback.changed',
  /** Nhiệm vụ: tạo mới / đổi trạng thái */
  TASK_CHANGED: 'task.changed',
  /** Có thông báo in-app mới cho đúng người nhận */
  NOTIFICATION_NEW: 'notification.new',
} as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

/**
 * Vai trò luôn nhận mọi biến động phản ánh / nhiệm vụ.
 *
 * Quản trị và lãnh đạo theo dõi toàn xã; tiếp nhận một cửa phải thấy phiếu mới ngay
 * để phân công. Chuyên viên (officer) chỉ nhận theo phòng bộ phận hoặc phòng cá nhân
 * để không bị nhiễu bởi việc của bộ phận khác. Danh sách này khớp roles.ts.
 */
const SUPERVISOR_ROLES = ['admin', 'leader', 'receptionist'];

/** Tiền tố phòng — mỗi client vào 3 phòng: vai trò, bộ phận, chính mình */
export const ROOM_ROLE = 'role:';
export const ROOM_DEPARTMENT = 'dept:';
export const ROOM_USER = 'user:';

/**
 * Gói tin đẩy xuống client — CỐ TÌNH gọn.
 *
 * Không đẩy cả bản ghi vì hai lý do: (1) tránh rò rỉ trường nhạy cảm (SĐT công dân
 * đang được che ở tầng HTTP), (2) client vẫn phải gọi API để lấy dữ liệu đã lọc theo
 * quyền của mình. Client nhận tin này rồi tự tải lại danh sách/chi tiết.
 */
export interface RealtimeChange {
  /** Loại thay đổi: 'created' | 'assigned' | 'resolved' | 'status'... */
  type: string;
  /** Mã bản ghi: #PA-2026-0141, NV-2601, hoặc mã thông báo */
  code: string;
  /** Trạng thái sau thay đổi */
  status: string;
  /** ISO 8601 — thời điểm phát sinh */
  at: string;
}

/**
 * Bộ phát sự kiện thời gian thực (P5-05).
 *
 * Tách khỏi RealtimeGateway để các module nghiệp vụ (Feedback, Tasks, Notification)
 * chỉ phụ thuộc vào một service thuần, không phụ thuộc vào tầng WebSocket.
 *
 * Giống MessagingService: mọi lời gọi ở đây đều "thất bại êm". Chưa có client nào
 * kết nối, hoặc tầng WebSocket chưa khởi tạo xong, thì chỉ ghi log — tuyệt đối
 * không được ném lỗi làm hỏng nghiệp vụ đang chạy.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  /** Máy chủ Socket.IO, do RealtimeGateway gắn vào lúc afterInit */
  private server?: Server;

  /** RealtimeGateway gọi khi tầng WebSocket đã sẵn sàng */
  bind(server: Server): void {
    this.server = server;
  }

  /** Gửi cho toàn bộ cán bộ thuộc một vai trò (admin, leader, officer...) */
  emitToRole(roleKey: string, event: RealtimeEvent, data: RealtimeChange): void {
    if (!roleKey) return;
    this.emitToRoom(`${ROOM_ROLE}${roleKey}`, event, data);
  }

  /** Gửi cho toàn bộ cán bộ thuộc một bộ phận (tên bộ phận được chuẩn hoá thành khoá phòng) */
  emitToDepartment(department: string, event: RealtimeEvent, data: RealtimeChange): void {
    const slug = departmentSlug(department);
    if (!slug) return;
    this.emitToRoom(`${ROOM_DEPARTMENT}${slug}`, event, data);
  }

  /** Gửi riêng cho một tài khoản (username cán bộ hoặc SĐT công dân) */
  emitToUser(username: string, event: RealtimeEvent, data: RealtimeChange): void {
    if (!username) return;
    this.emitToRoom(`${ROOM_USER}${username}`, event, data);
  }

  /**
   * Phát một biến động nghiệp vụ tới đúng nhóm người cần biết.
   *
   * Luôn gửi cho SUPERVISOR_ROLES (điều hành theo dõi toàn xã), cộng thêm bộ phận
   * chủ trì và cán bộ được phân công nếu đã xác định. Socket.IO tự khử trùng lặp
   * khi một client thuộc nhiều phòng nên mỗi người chỉ nhận đúng một lần.
   */
  emitChange(
    event: RealtimeEvent,
    data: RealtimeChange,
    target: { department?: string; user?: string } = {},
  ): void {
    const rooms = SUPERVISOR_ROLES.map((role) => `${ROOM_ROLE}${role}`);

    const slug = departmentSlug(target.department);
    if (slug) rooms.push(`${ROOM_DEPARTMENT}${slug}`);
    if (target.user) rooms.push(`${ROOM_USER}${target.user}`);

    this.emitToRoom(rooms, event, data);
  }

  /**
   * Số client đang kết nối — phục vụ giám sát / gỡ lỗi.
   *
   * Gateway chạy trên namespace riêng nên đối tượng nhận được ở `afterInit` thực chất
   * là Namespace của Socket.IO; ở đó `sockets` là Map các socket đang kết nối (khác
   * với Server gốc, nơi `sockets` lại là một Namespace).
   */
  connectionCount(): number {
    const sockets = this.server?.sockets as unknown as Map<string, unknown> | undefined;
    return sockets?.size ?? 0;
  }

  /* ─────────────────────────── Nội bộ ─────────────────────────── */

  private emitToRoom(room: string | string[], event: RealtimeEvent, data: RealtimeChange): void {
    if (!this.server) {
      this.logger.debug(`Bỏ qua ${event}: tầng WebSocket chưa sẵn sàng`);
      return;
    }
    try {
      this.server.to(room).emit(event, data);
      this.logger.debug(`${event} → ${Array.isArray(room) ? room.join(', ') : room} (${data.type} ${data.code})`);
    } catch (err) {
      // Lỗi tầng truyền tin không được phép làm hỏng nghiệp vụ đang chạy
      this.logger.warn(`Không phát được ${event} tới ${room}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/**
 * Chuẩn hoá tên bộ phận thành khoá phòng an toàn.
 *
 * Tên bộ phận tiếng Việt có dấu, khoảng trắng và cả gạch ngang dài
 * ("Địa chính – Xây dựng"). Bỏ dấu + thay ký tự lạ bằng '-' để khoá phòng luôn là
 * ASCII, tránh sai khác do cách gõ Unicode (NFC/NFD) giữa các nguồn dữ liệu.
 *
 * "Địa chính – Xây dựng" → "dia-chinh-xay-dung"
 */
export function departmentSlug(department?: string | null): string {
  if (!department) return '';
  return department
    .normalize('NFD')
    // Bỏ dấu thanh và dấu mũ (khối ký tự tổ hợp U+0300–U+036F)
    .replace(/[\u0300-\u036f]/g, '')
    // đ/Đ không tách được bằng NFD nên xử lý riêng
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
