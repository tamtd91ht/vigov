import { appConfig } from "@/config/app.config";
import { apiClient } from "@/services/api";
import { listSessions, type SessionRecord } from "@/services/users.service";

/**
 * Hồ sơ cá nhân của chính người đang đăng nhập (WBS #1).
 *
 * Khác `users.service.ts` ở chỗ: mọi hàm ở đây chỉ tác động lên CHÍNH tài khoản
 * đang dùng, nên không cần quyền quản trị người dùng. Tách riêng cũng để
 * `services/auth.ts` không phải nhập `apiClient` — `api.ts` đã nhập `auth.ts`,
 * thêm chiều ngược lại là tạo vòng phụ thuộc.
 */

/** Phản hồi của PATCH /auth/me/password */
export interface ChangePasswordResult {
  updated: boolean;
  /**
   * Số phiên bị thu hồi kèm theo. Đổi mật khẩu làm mọi phiên khác mất hiệu lực —
   * giao diện phải nói rõ để cán bộ biết vì sao máy khác bị đăng xuất.
   */
  revokedSessions: number;
}

/** Độ dài mật khẩu tối thiểu — kiểm tra sớm ở trình duyệt, máy chủ vẫn quyết định */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * PATCH /auth/me/password — tự đổi mật khẩu của mình.
 *
 * Máy chủ trả **400** cho "mật khẩu hiện tại không đúng", cố tình không dùng 401:
 * nhờ vậy lời gọi này đi qua `apiClient` như mọi service khác được, mà gõ sai
 * mật khẩu vẫn không bị hiểu thành phiên hết hạn rồi đá ra trang đăng nhập.
 * Thông báo lỗi lấy nguyên văn từ máy chủ.
 */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  if (appConfig.api.useMocks) {
    return { updated: true, revokedSessions: 0 };
  }
  return apiClient.patch<ChangePasswordResult>("/auth/me/password", { currentPassword, newPassword });
}

/**
 * Phiên đăng nhập của CHÍNH người đang dùng.
 *
 * Backend chưa có endpoint riêng "phiên của tôi": GET /users/sessions trả toàn
 * bộ phiên web của cơ quan (đó là màn hình bảo mật của quản trị). Ở đây lọc theo
 * tên đăng nhập — `subject` của phiên web chính là username, backend không che.
 */
export async function listOwnSessions(username: string): Promise<SessionRecord[]> {
  const res = await listSessions("web");
  return res.items.filter((s) => s.subject === username);
}
