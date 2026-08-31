import { appConfig } from "@/config/app.config";

/**
 * Adapter Zalo Mini App SDK.
 *
 * Hai chế độ chạy, quyết định bởi `appConfig.zalo.useMockSdk` (`VITE_USE_MOCK_SDK`):
 *
 * - MOCK (`=true`): trả dữ liệu mẫu, không đụng tới SDK. Dùng khi phát triển
 *   trên trình duyệt thường.
 * - THẬT (mặc định): gọi `zmp-sdk`. Ngoài ứng dụng Zalo — ví dụ bản nginx tĩnh
 *   ở cổng 8085 — SDK nạp được nhưng mọi lệnh đều ném lỗi, nên từng hàm đều bọc
 *   try/catch và rơi về giá trị trung tính. KHÔNG rơi về dữ liệu mẫu: giả vờ
 *   thành công ở môi trường thật che mất lỗi tích hợp.
 *
 * Cờ này KHÁC `api.useMocks`. Cái kia nói về dữ liệu nghiệp vụ lấy từ backend;
 * cái này nói về API thiết bị của Zalo. Trước đây dùng chung một cờ, nên bản
 * trình diễn offline vô tình tắt luôn camera thật — bấm quét chỉ quay một nhịp
 * rồi trả chuỗi mẫu.
 *
 * Ghi chú về `import()`: `vite.config.ts` đặt `codeSplitting: false` nên zmp-sdk
 * được gộp thẳng vào bundle — lệnh import dưới đây không sinh chunk rời, và
 * bundle vẫn nạp được bằng thẻ script cổ điển như Zalo yêu cầu.
 */

export interface ZaloUserProfile {
  id: string;
  name: string;
  avatar?: string;
}

export interface LocationResult {
  granted: boolean;
  /**
   * Toạ độ chỉ có ở bản mock. SDK đã bỏ `latitude`/`longitude`: bản thật chỉ
   * trả `token`, backend đổi token lấy toạ độ (hết hạn sau 2 phút, dùng 1 lần).
   */
  lat?: number;
  lng?: number;
  address?: string;
  token?: string;
}

/** Bật để thử luồng người dùng từ chối quyền vị trí (câu hỏi mở #16) */
export const zaloMockFlags = { denyLocation: false };

/** Phần API của zmp-sdk mà ứng dụng này dùng — khai hẹp để lỗi lộ ra lúc biên dịch */
type ZmpSdk = Pick<
  typeof import("zmp-sdk"),
  "getUserInfo" | "getPhoneNumber" | "scanQRCode" | "chooseImage" | "getLocation" | "openChat" | "openPhone"
>;

function delay(ms: number = appConfig.api.mockDelayMs): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let sdkPromise: Promise<ZmpSdk | null> | null = null;

/** Nạp zmp-sdk một lần rồi dùng lại; null khi đang chạy mock hoặc nạp hỏng */
function loadSdk(): Promise<ZmpSdk | null> {
  if (appConfig.zalo.useMockSdk) return Promise.resolve(null);
  sdkPromise ??= import("zmp-sdk")
    .then((m) => m as ZmpSdk)
    .catch((err: unknown) => {
      console.warn("[zalo] không nạp được zmp-sdk", err);
      return null;
    });
  return sdkPromise;
}

/**
 * Gọi một lệnh SDK, nuốt lỗi và trả `fallback`.
 *
 * Ngoài Zalo mọi lệnh đều ném — đó là trạng thái bình thường của bản web tĩnh,
 * không phải sự cố, nên chỉ ghi log mức debug.
 */
async function attempt<T>(label: string, run: (sdk: ZmpSdk) => Promise<T>, fallback: T): Promise<T> {
  const sdk = await loadSdk();
  if (!sdk) return fallback;
  try {
    return await run(sdk);
  } catch (err: unknown) {
    console.debug(`[zalo] ${label} thất bại`, err);
    return fallback;
  }
}

export const zaloService = {
  /** Thông tin hiển thị của người dùng Zalo */
  async getUserProfile(): Promise<ZaloUserProfile | null> {
    if (appConfig.zalo.useMockSdk) {
      await delay();
      return { id: "mock-user", name: "Người dùng Zalo" };
    }
    return attempt(
      "getUserInfo",
      async (sdk) => {
        // Tên và ảnh đại diện thuộc dữ liệu cá nhân theo NĐ 13/2023 — phải xin phép,
        // `autoRequestPermission` bật form xác nhận thay cho việc gọi authorize() riêng.
        const { userInfo } = await sdk.getUserInfo({ autoRequestPermission: true });
        return { id: userInfo.id, name: userInfo.name, avatar: userInfo.avatar };
      },
      null,
    );
  },

  /**
   * Số điện thoại người dùng.
   *
   * SDK chỉ trả `token`; đổi ra số thật là việc của backend (cần ZALO_APP_SECRET,
   * mà cái đó phụ thuộc Zalo OA/Business khách chưa đăng ký — câu hỏi mở #3).
   * Trường `number` đã bị SDK đánh dấu deprecated, chỉ đọc phòng khi máy cũ còn trả.
   */
  async requestPhoneNumber(): Promise<string | null> {
    if (appConfig.zalo.useMockSdk) {
      await delay();
      return "0987654321";
    }
    return attempt("getPhoneNumber", async (sdk) => (await sdk.getPhoneNumber()).number ?? null, null);
  },

  /**
   * Token định danh do Zalo cấp, gửi lên POST /auth/citizen/zalo/identify để
   * backend đổi lấy số điện thoại thật. Token dùng một lần, hết hạn sau 2 phút.
   *
   * Trả null khi chạy ngoài Zalo — lúc đó SessionContext rơi về luồng OTP.
   */
  async requestPhoneToken(): Promise<string | null> {
    if (appConfig.zalo.useMockSdk) return null;
    return attempt("getPhoneNumber(token)", async (sdk) => (await sdk.getPhoneNumber()).token ?? null, null);
  },

  /** Quét mã QR hồ sơ một cửa */
  async scanQrCode(): Promise<string | null> {
    if (appConfig.zalo.useMockSdk) {
      await delay();
      return "HS-2026-04182";
    }
    return attempt("scanQRCode", async (sdk) => (await sdk.scanQRCode()).content, null);
  },

  /**
   * Quét mã QR in trên mặt trước thẻ CCCD gắn chip (P5-11, tầng 2).
   *
   * Tách riêng khỏi scanQrCode() dù cùng gọi một API SDK: hai luồng nghiệp vụ
   * khác nhau, chuỗi trả về khác định dạng, và tách ra thì bản mock mới trả
   * được dữ liệu mẫu đúng kiểu cho từng luồng.
   *
   * Chuỗi trả về CHƯA được kiểm tra — nơi gọi phải đưa qua parseCccdQr().
   * Người dùng hoàn toàn có thể chĩa máy vào một QR bất kỳ.
   */
  async scanCccdQr(): Promise<string | null> {
    if (appConfig.zalo.useMockSdk) {
      await delay();
      // Dữ liệu mẫu, KHÔNG phải người thật — số CCCD và địa chỉ đều bịa
      return "001099012345|123456789|Nguyễn Văn An|01011990|Nam|Số 1, Thôn Đông, Xã Đại Thắng, Huyện Phú Xuyên, Thành phố Hà Nội|15062021";
    }
    return attempt("scanQRCode(cccd)", async (sdk) => (await sdk.scanQRCode()).content, null);
  },

  /**
   * Vị trí hiện tại.
   *
   * Bản thật chỉ có `token` — không có toạ độ để hiển thị ngay, nên `address`
   * bỏ trống và người dùng tự nhập (đúng luồng "từ chối" đã có sẵn ở màn phản ánh).
   * Điền địa chỉ tự động được sau khi backend làm bước đổi token + reverse geocode (P3-26).
   */
  async getLocation(): Promise<LocationResult> {
    if (appConfig.zalo.useMockSdk) {
      await delay();
      if (zaloMockFlags.denyLocation) return { granted: false };
      return {
        granted: true,
        lat: 20.7431,
        lng: 105.9214,
        address: `Đường trục Thôn Đông, ${appConfig.org.name}`,
      };
    }
    return attempt(
      "getLocation",
      async (sdk) => {
        const { token } = await sdk.getLocation();
        // Không token nghĩa là người dùng bấm từ chối trên popup của Zalo
        return token ? { granted: true, token } : { granted: false };
      },
      { granted: false },
    );
  },

  /**
   * Mở cửa sổ chat Zalo.
   *
   * CHẶN: openChat cần ID Zalo của người nhận (`type: 'user'`) hoặc ID Official
   * Account (`type: 'oa'`) — KHÔNG nhận số điện thoại. Danh bạ cán bộ chỉ có số
   * điện thoại, nên đường duy nhất là chat qua OA của xã, mà khách chưa đăng ký
   * Zalo OA (VITE_ZALO_OA_ID còn rỗng). Chừng nào chưa có OA thì hàm này trả
   * false và giao diện phải nói thật là chưa dùng được.
   */
  async openChat(phone: string): Promise<boolean> {
    if (appConfig.zalo.useMockSdk) {
      await delay(120);
      return true;
    }
    const oaId = appConfig.zalo.oaId;
    if (!oaId) {
      console.debug("[zalo] openChat bỏ qua: chưa cấu hình VITE_ZALO_OA_ID", { phone });
      return false;
    }
    return attempt(
      "openChat",
      async (sdk) => {
        await sdk.openChat({ type: "oa", id: oaId });
        return true;
      },
      false,
    );
  },

  /** Gọi điện — trong Zalo dùng openPhone, ngoài Zalo rơi về liên kết tel: */
  async call(phone: string): Promise<boolean> {
    if (appConfig.zalo.useMockSdk) {
      await delay(120);
      return true;
    }
    const ok = await attempt(
      "openPhone",
      async (sdk) => {
        await sdk.openPhone({ phoneNumber: phone });
        return true;
      },
      false,
    );
    if (ok) return true;
    // Trình duyệt thường: để hệ điều hành tự chọn ứng dụng gọi
    window.location.href = `tel:${phone}`;
    return true;
  },

  /**
   * Chọn ảnh từ album hoặc camera.
   *
   * Trả về đường dẫn các tệp đã chọn, mảng rỗng nghĩa là người dùng huỷ hoặc
   * không gọi được. Tải ảnh lên máy chủ thuộc phần đính kèm phản ánh, chưa làm.
   */
  async chooseImage(): Promise<string[]> {
    if (appConfig.zalo.useMockSdk) {
      await delay(200);
      return ["mock://anh-mau"];
    }
    return attempt(
      "chooseImage",
      async (sdk) => (await sdk.chooseImage({ count: 1, sourceType: ["album", "camera"] })).filePaths,
      [],
    );
  },
};
