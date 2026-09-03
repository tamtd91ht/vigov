import { appConfig } from "@/config/app.config";
import { apiClient, mockDelay } from "@/services/api";
import { mockEconomyMap } from "@/mocks/map.mock";
import type { EconomyMap } from "@/types";

/**
 * Bản đồ kinh tế số của xã (WBS #7 — nhánh công dân).
 * Nguồn: GET /map/public/economy — endpoint @Public, không cần token.
 *
 * Backend trả lớp và ghim trong MỘT lần gọi nên service không phải ghép,
 * và màn hình chỉ có một nhịp tải thay vì hai.
 *
 * Cờ appConfig.api.useMocks rẽ nhánh ngay tại đây để demo offline vẫn chạy.
 */
export const mapService = {
  async economy(): Promise<EconomyMap> {
    if (appConfig.api.useMocks) {
      await mockDelay();
      return mockEconomyMap;
    }

    return apiClient.get<EconomyMap>("/map/public/economy");
  },
};
