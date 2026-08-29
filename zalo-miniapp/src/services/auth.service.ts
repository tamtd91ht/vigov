import { appConfig } from "@/config/app.config";
import { ApiError, apiClient, clearStoredSession, mockDelay, writeStoredSession } from "@/services/api";
import { zaloService } from "@/services/zalo";
import type { CitizenSession } from "@/types";

/**
 * Định danh công dân.
 *
 * ĐƯỜNG CHÍNH — Zalo: SDK cấp token, backend đổi token lấy số điện thoại tại
 * Zalo Open API (POST /auth/citizen/zalo/identify). Đường này CHỈ chạy được khi
 * khách đã cấp Zalo OA/Business để backend cấu hình ZALO_APP_SECRET
 * (câu hỏi mở #3). Chưa có secret thì backend trả 401 "Không lấy được số điện
 * thoại từ Zalo".
 *
 * ĐƯỜNG THAY THẾ — OTP: nhập số điện thoại, backend gửi mã 6 chữ số
 * (POST /auth/citizen/otp/request) rồi xác thực (POST /auth/citizen/otp/verify).
 * Phase 1 backend chỉ GHI MÃ RA LOG MÁY CHỦ, chưa gửi SMS/ZNS thật.
 * Đây là đường dùng khi phát triển/demo trên trình duyệt.
 */

/** Phản hồi định danh của backend (cả hai đường đều trả dạng này) */
interface CitizenAuthResponse {
  accessToken: string;
  user: { phone: string; displayName: string; area?: string };
}

interface OtpRequestResponse {
  sent: boolean;
  expiresInSeconds: number;
}

/** Kết quả thử định danh bằng Zalo */
export type IdentifyResult =
  | { kind: "ok"; session: CitizenSession }
  /** Không đi được đường Zalo — màn onboarding chuyển sang ô nhập SĐT + mã */
  | { kind: "otp"; reason: string };

const REASON_NO_TOKEN =
  "Chưa lấy được số điện thoại từ Zalo. Vui lòng định danh bằng mã xác thực gửi tới số điện thoại của bạn.";

/** Độ dài mã OTP backend cấp */
export const OTP_LENGTH = 6;

/** Số điện thoại Việt Nam 10 chữ số bắt đầu bằng 0 — khớp RequestOtpDto của backend */
export function isValidPhone(phone: string): boolean {
  return /^0\d{9}$/.test(phone);
}

function toSession(res: CitizenAuthResponse): CitizenSession {
  return {
    phone: res.user.phone,
    displayName: res.user.displayName || `Công dân ${res.user.phone.slice(-3)}`,
    identifiedAt: new Date().toISOString(),
    area: res.user.area,
    accessToken: res.accessToken,
  };
}

/** Ghi phiên xuống localStorage để api.ts gắn được JWT vào các lời gọi sau */
function persist(session: CitizenSession): CitizenSession {
  writeStoredSession(session);
  return session;
}

export const authService = {
  /** Thử đường Zalo; hỏng ở bất kỳ khâu nào thì báo màn onboarding rơi về OTP */
  async identifyWithZalo(): Promise<IdentifyResult> {
    if (appConfig.api.useMocks) {
      await mockDelay();
      const phone = (await zaloService.requestPhoneNumber()) ?? "0987654321";
      const profile = await zaloService.getUserProfile();
      return {
        kind: "ok",
        session: persist({
          phone,
          displayName: profile?.name ?? `Công dân ${phone.slice(-3)}`,
          identifiedAt: new Date().toISOString(),
        }),
      };
    }

    const token = await zaloService.requestPhoneToken();
    if (!token) return { kind: "otp", reason: REASON_NO_TOKEN };

    const profile = await zaloService.getUserProfile();
    try {
      const res = await apiClient.post<CitizenAuthResponse>("/auth/citizen/zalo/identify", {
        token,
        zaloUserId: profile?.id,
        displayName: profile?.name,
      });
      return { kind: "ok", session: persist(toSession(res)) };
    } catch (err: unknown) {
      // 401 ở đây nghĩa là backend chưa cấu hình được ZALO_APP_SECRET —
      // không phải lỗi của người dùng, cứ chuyển sang đường OTP.
      return { kind: "otp", reason: err instanceof ApiError ? err.message : REASON_NO_TOKEN };
    }
  },

  /** Yêu cầu backend cấp mã OTP cho số điện thoại */
  async requestOtp(phone: string): Promise<OtpRequestResponse> {
    if (appConfig.api.useMocks) {
      await mockDelay();
      return { sent: true, expiresInSeconds: 300 };
    }
    return apiClient.post<OtpRequestResponse>("/auth/citizen/otp/request", { phone });
  },

  /** Xác thực mã OTP và lưu phiên kèm JWT */
  async verifyOtp(phone: string, otp: string): Promise<CitizenSession> {
    if (appConfig.api.useMocks) {
      await mockDelay();
      return persist({
        phone,
        displayName: `Công dân ${phone.slice(-3)}`,
        identifiedAt: new Date().toISOString(),
      });
    }
    const res = await apiClient.post<CitizenAuthResponse>("/auth/citizen/otp/verify", {
      phone,
      otp,
      device: "Zalo Mini App",
    });
    return persist(toSession(res));
  },

  logout(): void {
    clearStoredSession();
  },
};
