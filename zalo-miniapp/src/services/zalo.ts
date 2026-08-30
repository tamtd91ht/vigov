import { appConfig } from "@/config/app.config";

/**
 * Adapter Zalo Mini App SDK.
 *
 * Phase 1 chạy MOCK để phát triển/demo trên trình duyệt (appConfig.api.useMocks).
 * Khi chạy thật trong Zalo: bỏ cờ mock, các hàm dưới gọi `zmp-sdk` qua dynamic import
 * — kết nối SDK thật (SĐT, QR, GPS trên thiết bị) thuộc hệ số tích hợp bên ngoài.
 */

export interface ZaloUserProfile {
  id: string;
  name: string;
  avatar?: string;
}

export interface LocationResult {
  granted: boolean;
  lat?: number;
  lng?: number;
  address?: string;
}

/** Bật để thử luồng người dùng từ chối quyền vị trí (câu hỏi mở #16) */
export const zaloMockFlags = { denyLocation: false };

function delay(ms: number = appConfig.api.mockDelayMs): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Nạp zmp-sdk khi chạy thật; trả null nếu không khả dụng (trình duyệt thường) */
async function loadSdk(): Promise<Record<string, unknown> | null> {
  if (appConfig.api.useMocks) return null;
  try {
    return (await import("zmp-sdk")) as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const zaloService = {
  /** Thông tin hiển thị của người dùng Zalo */
  async getUserProfile(): Promise<ZaloUserProfile | null> {
    const sdk = await loadSdk();
    if (!sdk) {
      await delay();
      return { id: "mock-user", name: "Người dùng Zalo" };
    }
    // Thật: sdk.getUserInfo({ autoRequestPermission: true })
    return null;
  },

  /**
   * Xin quyền và lấy số điện thoại: SDK trả token, server đổi token lấy SĐT.
   * Mock trả về SĐT mẫu để chạy được luồng định danh trên trình duyệt.
   */
  async requestPhoneNumber(): Promise<string | null> {
    const sdk = await loadSdk();
    if (!sdk) {
      await delay();
      return "0987654321";
    }
    // Thật: token = sdk.getPhoneNumber() -> POST /auth/zalo/phone { token }
    return null;
  },

  /**
   * Token định danh do Zalo SDK cấp, gửi lên POST /auth/citizen/zalo/identify
   * để backend đổi lấy số điện thoại thật.
   *
   * Trả null khi chạy ngoài Zalo (trình duyệt) — lúc đó SessionContext rơi về
   * luồng OTP. Ngay cả khi có token, backend vẫn từ chối chừng nào khách chưa
   * cấp Zalo OA/Business để cấu hình ZALO_APP_SECRET (câu hỏi mở #3).
   */
  async requestPhoneToken(): Promise<string | null> {
    const sdk = await loadSdk();
    if (!sdk) return null;
    // Thật: const { token } = await sdk.getPhoneNumber();
    return null;
  },

  /** Quét mã QR hồ sơ một cửa */
  async scanQrCode(): Promise<string | null> {
    const sdk = await loadSdk();
    if (!sdk) {
      await delay();
      return "HS-2026-04182";
    }
    // Thật: sdk.scanQRCode()
    return null;
  },

  /**
   * Quét mã QR in trên mặt trước thẻ CCCD gắn chip (P5-11, tầng 2).
   *
   * Tách riêng khỏi scanQrCode() dù cùng gọi một API SDK: hai luồng nghiệp vụ
   * khác nhau, trả về chuỗi có định dạng khác nhau, và tách ra thì bản mock
   * mới trả được dữ liệu mẫu đúng kiểu cho từng luồng.
   *
   * Chuỗi trả về CHƯA được kiểm tra — nơi gọi phải đưa qua parseCccdQr().
   * Người dùng hoàn toàn có thể chĩa máy vào một QR bất kỳ.
   */
  async scanCccdQr(): Promise<string | null> {
    const sdk = await loadSdk();
    if (!sdk) {
      await delay();
      // Dữ liệu mẫu, KHÔNG phải người thật — số CCCD và địa chỉ đều bịa
      return "001099012345|123456789|Nguyễn Văn An|01011990|Nam|Số 1, Thôn Đông, Xã Đại Thắng, Huyện Phú Xuyên, Thành phố Hà Nội|15062021";
    }
    // Thật: const { content } = await sdk.scanQRCode();
    return null;
  },

  /** Lấy vị trí hiện tại + địa chỉ (reverse geocode ở backend P3-26) */
  async getLocation(): Promise<LocationResult> {
    const sdk = await loadSdk();
    if (!sdk) {
      await delay();
      if (zaloMockFlags.denyLocation) return { granted: false };
      return {
        granted: true,
        lat: 20.7431,
        lng: 105.9214,
        address: `Đường trục Thôn Đông, ${appConfig.org.name}`,
      };
    }
    // Thật: sdk.getLocation({ fail: () => granted false })
    return { granted: false };
  },

  /** Mở cửa sổ chat Zalo với OA / lãnh đạo xã */
  async openChat(phone: string): Promise<boolean> {
    const sdk = await loadSdk();
    if (!sdk) {
      await delay(120);
      return true;
    }
    // Thật: sdk.openChat({ type: 'oa'|'user', id: ..., message })
    void phone;
    return false;
  },

  /** Gọi điện — trong Zalo dùng openPhone, trên web dùng tel: */
  async call(phone: string): Promise<boolean> {
    const sdk = await loadSdk();
    if (!sdk) {
      await delay(120);
      return true;
    }
    // Thật: sdk.openPhone({ phoneNumber: phone })
    void phone;
    return false;
  },

  /** Chọn ảnh từ máy — mock chỉ báo thành công, ảnh hiển thị bằng placeholder */
  async chooseImage(): Promise<boolean> {
    const sdk = await loadSdk();
    if (!sdk) {
      await delay(200);
      return true;
    }
    // Thật: sdk.chooseImage({ count, sourceType })
    return false;
  },
};
