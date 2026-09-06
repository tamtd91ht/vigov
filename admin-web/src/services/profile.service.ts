import { appConfig } from "@/config/app.config";
import { apiClient } from "@/services/api";


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
   * Cặp token mới, CHỈ có khi vừa thoát trạng thái mật khẩu tạm: cờ
   * `mustChangePassword` nằm trong chữ ký JWT nên token cũ vẫn bị máy chủ chặn.
   */
  accessToken?: string;
  refreshToken?: string;
  /**
   * Số phiên bị thu hồi kèm theo. Đổi mật khẩu làm mọi phiên khác mất hiệu lực —
   * giao diện phải nói rõ để cán bộ biết vì sao máy khác bị đăng xuất.
   */
  revokedSessions: number;
}

/**
 * Độ dài mật khẩu tối thiểu — GIỮ BẰNG `MIN_PASSWORD_LENGTH` trong
 * `libs/shared/src/auth/password-policy.ts` của backend. Đây chỉ là kiểm tra
 * sớm cho đỡ một lượt gọi mạng; máy chủ mới là nơi quyết định và nó còn xét
 * thêm các luật khác (có chữ, có số, không chứa tên đăng nhập, không quá phổ biến).
 */
export const MIN_PASSWORD_LENGTH = 10;

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

/** Một phiên đăng nhập của chính người đang dùng (GET /auth/me/sessions) */
export interface OwnSession {
  id: string;
  /** web (Web Quản trị) · app (app công dân) · zalo (Mini App) */
  kind: string;
  device: string;
  ip: string;
  startedAt: string;
  lastActiveAt: string;
  /** Phiên đang dùng để mở trang này — không cho tự thu hồi */
  current: boolean;
}

/**
 * Phiên đăng nhập của CHÍNH người đang dùng.
 *
 * Dùng `GET /auth/me/sessions` chứ KHÔNG dùng `GET /users/sessions`: đường sau
 * là màn hình bảo mật của quản trị, đòi quyền `users:view` và trả phiên của cả
 * cơ quan. Trước đây trang này lọc danh sách đó theo tên đăng nhập, nghĩa là
 * vai trò không có quyền xem danh sách phiên thì không thấy được cả phiên của
 * chính họ.
 */
export async function listOwnSessions(): Promise<OwnSession[]> {
  const res = await apiClient.get<{ items: OwnSession[]; total: number }>("/auth/me/sessions");
  return res.items ?? [];
}

/** Đăng xuất một thiết bị cụ thể của chính mình (DELETE /auth/me/sessions/:id) */
export async function revokeOwnSession(id: string): Promise<void> {
  await apiClient.delete<{ id: string; revoked: boolean }>(
    `/auth/me/sessions/${encodeURIComponent(id)}`,
  );
}
