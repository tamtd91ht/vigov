import type { EconomyMap } from "@/types";

/**
 * Bản đồ kinh tế mẫu — dùng khi appConfig.api.useMocks bật (demo offline).
 * Đồng bộ 8 lớp với Web Quản trị (WBS #7); toạ độ x/y là % trong khung bản đồ
 * mô phỏng, khớp cách MapCanvas đặt ghim.
 *
 * Số liệu và tên cơ sở đều bịa — KHÔNG phải cơ sở có thật.
 */
export const mockEconomyMap: EconomyMap = {
  layers: [
    { key: "dn", label: "Doanh nghiệp", color: "var(--blue)", defaultOn: true, count: 4 },
    { key: "hkd", label: "Hộ kinh doanh", color: "var(--teal)", defaultOn: true, count: 4 },
    { key: "cho", label: "Chợ", color: "var(--orange)", defaultOn: true, count: 2 },
    { key: "truong", label: "Trường học", color: "var(--purple)", defaultOn: true, count: 3 },
    { key: "yte", label: "Y tế", color: "var(--pink)", defaultOn: true, count: 2 },
    { key: "ditich", label: "Di tích", color: "var(--green)", defaultOn: false, count: 2 },
    { key: "hatang", label: "Hạ tầng công cộng", color: "var(--slate)", defaultOn: false, count: 3 },
    { key: "dautu", label: "Đầu tư công", color: "var(--navy)", defaultOn: false, count: 2 },
  ],
  pins: [
    // ── Doanh nghiệp ─────────────────────────────────────────────────
    { id: "m1", layerKey: "dn", name: "Công ty TNHH May Đại Thắng", industry: "May mặc", address: "Thôn Đông, Xã Đại Thắng", workers: 128, x: 18, y: 22 },
    { id: "m2", layerKey: "dn", name: "Công ty CP Cơ khí Phú Xuyên", industry: "Cơ khí chế tạo", address: "Cụm CN Đại Thắng", workers: 76, x: 64, y: 24 },
    { id: "m3", layerKey: "dn", name: "Công ty TNHH Nông sản Sông Nhuệ", industry: "Chế biến nông sản", address: "Thôn Đoài, Xã Đại Thắng", workers: 45, x: 72, y: 32 },
    { id: "m4", layerKey: "dn", name: "Xưởng gỗ mỹ nghệ Trung Kiên", industry: "Chế biến gỗ", address: "Thôn Trung, Xã Đại Thắng", workers: 31, x: 24, y: 66 },

    // ── Hộ kinh doanh ────────────────────────────────────────────────
    { id: "m5", layerKey: "hkd", name: "Hộ KD Tạp hoá Minh Anh", industry: "Bán lẻ tổng hợp", address: "Tổ dân phố số 5", workers: 3, x: 62, y: 70 },
    { id: "m6", layerKey: "hkd", name: "Hộ KD Vật liệu xây dựng Hùng Phát", industry: "Vật liệu xây dựng", address: "Đường liên xã ĐT-428", workers: 6, x: 48, y: 52 },
    { id: "m7", layerKey: "hkd", name: "Hộ KD Ăn uống Bến Đò", industry: "Dịch vụ ăn uống", address: "Thôn Đông, Xã Đại Thắng", workers: 5, x: 14, y: 34 },
    { id: "m8", layerKey: "hkd", name: "Hộ KD Sửa chữa xe máy Tuấn", industry: "Sửa chữa cơ khí", address: "Thôn Đoài, Xã Đại Thắng", workers: 2, x: 78, y: 46 },

    // ── Chợ ──────────────────────────────────────────────────────────
    { id: "m9", layerKey: "cho", name: "Chợ Đại Thắng", industry: "Chợ hạng 3", address: "Trung tâm xã", workers: 84, x: 44, y: 40 },
    { id: "m10", layerKey: "cho", name: "Chợ chiều Thôn Đoài", industry: "Chợ dân sinh", address: "Thôn Đoài, Xã Đại Thắng", workers: 22, x: 70, y: 18 },

    // ── Trường học ───────────────────────────────────────────────────
    { id: "m11", layerKey: "truong", name: "Trường Tiểu học Đại Thắng", industry: "Giáo dục tiểu học", address: "Thôn Trung, Xã Đại Thắng", workers: 38, x: 30, y: 76 },
    { id: "m12", layerKey: "truong", name: "Trường THCS Đại Thắng", industry: "Giáo dục THCS", address: "Trung tâm xã", workers: 42, x: 52, y: 62 },
    { id: "m13", layerKey: "truong", name: "Trường Mầm non Hoa Sen", industry: "Giáo dục mầm non", address: "Thôn Đông, Xã Đại Thắng", workers: 26, x: 20, y: 14 },

    // ── Y tế ─────────────────────────────────────────────────────────
    { id: "m14", layerKey: "yte", name: "Trạm Y tế xã Đại Thắng", industry: "Y tế cơ sở", address: "Trung tâm xã", workers: 9, x: 40, y: 28 },
    { id: "m15", layerKey: "yte", name: "Quầy thuốc Bình An", industry: "Bán lẻ dược phẩm", address: "Tổ dân phố số 5", workers: 2, x: 66, y: 82 },

    // ── Di tích ──────────────────────────────────────────────────────
    { id: "m16", layerKey: "ditich", name: "Đình làng Đông", industry: "Di tích cấp tỉnh", address: "Thôn Đông, Xã Đại Thắng", workers: 0, x: 10, y: 50 },
    { id: "m17", layerKey: "ditich", name: "Chùa Đoài Linh Tự", industry: "Di tích tín ngưỡng", address: "Thôn Đoài, Xã Đại Thắng", workers: 0, x: 84, y: 62 },

    // ── Hạ tầng công cộng ────────────────────────────────────────────
    { id: "m18", layerKey: "hatang", name: "Nhà văn hoá xã", industry: "Thiết chế văn hoá", address: "Trung tâm xã", workers: 4, x: 46, y: 20 },
    { id: "m19", layerKey: "hatang", name: "Sân thể thao Thôn Trung", industry: "Thể dục thể thao", address: "Thôn Trung, Xã Đại Thắng", workers: 0, x: 16, y: 84 },
    { id: "m20", layerKey: "hatang", name: "Trạm bơm Sông Nhuệ", industry: "Thuỷ lợi", address: "Ven Sông Nhuệ", workers: 6, x: 34, y: 8 },

    // ── Đầu tư công ──────────────────────────────────────────────────
    { id: "m21", layerKey: "dautu", name: "Dự án nâng cấp ĐT-428", industry: "Hạ tầng giao thông", address: "Đường liên xã ĐT-428", workers: 0, x: 56, y: 46 },
    { id: "m22", layerKey: "dautu", name: "Dự án kênh tiêu Thôn Đoài", industry: "Thuỷ lợi nội đồng", address: "Thôn Đoài, Xã Đại Thắng", workers: 0, x: 80, y: 74 },
  ],
};
