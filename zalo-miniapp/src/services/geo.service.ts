import { apiClient } from "@/services/api";

/** Phản hồi của POST /geo/zalo-location */
export interface ResolvedLocation {
  lat: number;
  lng: number;
  address: string | null;
  /** Provider GIS sinh ra `address` — "mock" nghĩa là địa chỉ BỊA, không được hiện */
  addressProvider: string;
}

/**
 * Provider GIS giả lập bịa địa chỉ từ toạ độ. Một địa chỉ bịa gắn lên toạ độ
 * thật thì công dân đọc tưởng thật rồi gửi phiếu sai chỗ, cán bộ tới nhầm nơi.
 * Nên chừng nào chưa chốt nhà cung cấp bản đồ (câu hỏi mở #2), chỉ hiện bản đồ
 * + toạ độ và để người dân tự gõ địa chỉ.
 */
const MOCK_GEO_PROVIDER = "mock";

/** Địa chỉ chỉ được dùng khi do provider THẬT sinh ra */
export function usableAddress(res: ResolvedLocation): string {
  if (!res.address) return "";
  return res.addressProvider === MOCK_GEO_PROVIDER ? "" : res.address;
}

export const geoService = {
  /**
   * Đổi mã định vị của Zalo lấy toạ độ thật (P3-26).
   *
   * Mã KHÔNG đổi được ở phía Mini App: cần ZALO_APP_SECRET, thứ không được phép
   * nằm trong bundle vì bundle ở trên máy người dùng. Nên phải qua backend.
   *
   * Mã dùng một lần, hết hạn sau 2 phút — thất bại thì phải xin mã MỚI bằng
   * getLocation(), không được gọi lại với mã cũ.
   */
  async resolveZaloLocation(token: string, accessToken: string): Promise<ResolvedLocation> {
    return apiClient.post<ResolvedLocation>("/geo/zalo-location", { token, accessToken });
  },

  /** Toạ độ → địa chỉ, dùng cho toạ độ lấy từ navigator.geolocation */
  async reverse(lat: number, lng: number): Promise<ResolvedLocation> {
    return apiClient.get<ResolvedLocation>(`/geo/reverse?lat=${lat}&lng=${lng}`);
  },
};
