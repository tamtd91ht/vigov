import { Logger } from '@nestjs/common';

/**
 * Gọi `graph.zalo.me/v2.0/me/info` — điểm cuối Zalo dùng để đổi MỘT mã dùng
 * một lần lấy dữ liệu thật của người dùng.
 *
 * Cùng một điểm cuối phục vụ hai việc, phân biệt bởi mã được gửi lên:
 *   · mã của `getPhoneNumber()` → `data.number`
 *   · mã của `getLocation()`    → `data.latitude` / `data.longitude`
 *
 * Tách ra dùng chung vì hợp đồng gọi giống nhau từng chi tiết, và mỗi chi tiết
 * đều là một cách sai lặng lẽ:
 *   · Cần ĐỦ BA header, thiếu một là Zalo từ chối: `access_token` (phiên đăng
 *     nhập của chính người dùng), `code` (mã dùng một lần), `secret_key`
 *     (ZALO_APP_SECRET, chỉ có ở máy chủ).
 *   · Zalo trả HTTP 200 CẢ KHI lỗi nghiệp vụ — chỉ `error !== 0` mới là thất
 *     bại. Kiểm tra `res.ok` rồi đọc dữ liệu luôn là sai.
 *   · Mã hết hạn sau 2 phút và dùng được một lần.
 *
 * KHÔNG bao giờ ghi `code` hay `secret_key` vào nhật ký.
 */
const ZALO_GRAPH_ME_INFO_URL = 'https://graph.zalo.me/v2.0/me/info';

/** Hạn chờ gọi Zalo — quá thì coi như thất bại để nghiệp vụ rẽ đường khác */
const ZALO_GRAPH_TIMEOUT_MS = 8000;

/** Phần `data` của phản hồi, hợp của cả hai luồng đang dùng */
export interface ZaloMeInfoData {
  /** Luồng getPhoneNumber — số điện thoại kèm mã quốc gia */
  number?: string;
  /** Luồng getLocation — Zalo trả toạ độ dạng CHUỖI */
  latitude?: string | number;
  longitude?: string | number;
}

export interface ZaloMeInfoResponse {
  data?: ZaloMeInfoData;
  error: number;
  message?: string;
}

export interface ZaloMeInfoResult {
  data?: ZaloMeInfoData;
  /** Lý do thất bại, đã lọc sạch mã bí mật — an toàn để ghi log hoặc trả lên API */
  error?: string;
}

/**
 * Đổi một mã Zalo lấy dữ liệu tương ứng.
 *
 * Trả `{ data }` khi thành công, `{ error }` khi không — KHÔNG ném ngoại lệ, vì
 * cả hai nơi gọi đều cần rẽ nhánh mềm (công dân rơi về OTP, hoặc tự nhập địa chỉ)
 * chứ không muốn 500.
 */
export async function callZaloMeInfo(
  code: string,
  accessToken: string | undefined,
  secret: string,
  logger: Logger,
): Promise<ZaloMeInfoResult> {
  if (!secret) return { error: 'Chưa cấu hình ZALO_APP_SECRET' };
  if (!accessToken) return { error: 'Mini App không gửi access_token' };
  if (!code) return { error: 'Thiếu mã dùng một lần của Zalo' };

  /* Hạn chờ: không có thì một lần Zalo treo là giữ luôn kết nối của công dân
     cho tới khi nginx cắt, người dùng nhìn thấy màn hình đứng im. */
  try {
    const res = await fetch(ZALO_GRAPH_ME_INFO_URL, {
      method: 'GET',
      headers: { access_token: accessToken, code, secret_key: secret },
      signal: AbortSignal.timeout(ZALO_GRAPH_TIMEOUT_MS),
    });

    if (!res.ok) {
      logger.error(`Zalo trả HTTP ${res.status} khi đổi mã`);
      return { error: `Zalo trả HTTP ${res.status}` };
    }

    const body = (await res.json()) as ZaloMeInfoResponse;
    if (body.error !== 0) {
      const detail = `[${body.error}] ${body.message ?? ''}`.trim();
      logger.error(`Zalo từ chối đổi mã: ${detail}`);
      return { error: `Zalo từ chối đổi mã: ${detail}` };
    }

    return { data: body.data ?? {} };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.error(`Không gọi được Zalo Graph API: ${reason}`);
    return { error: `Không gọi được Zalo Graph API: ${reason}` };
  }
}
