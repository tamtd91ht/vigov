# P1-07 — Bản đồ Kinh tế số

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #7 — Bản đồ toàn màn hình với 8 lớp bật/tắt (doanh nghiệp, hộ KD, chợ, trường, y tế, di tích, hạ tầng công cộng, đầu tư công), ghim popup chi tiết cơ sở, panel phân tích cơ cấu ngành (pie) + 4 chỉ số tổng hợp. Provider bản đồ thật TBD (VietMap/Goong/MapLibre) — Phase này dùng canvas mô phỏng như mockup, kiến trúc adapter để thay provider.

## Kế hoạch thực hiện

- [x] Route `/map`. Spec UI: prototype dòng 1554–1618 (renderMap) + MOCK_DATA.banDo (8 lớp, 22 ghim).
- [x] Lớp map trừu tượng hoá qua `features/map/MapCanvas` (props: layers, pins, onPinClick) — khi chốt provider chỉ thay component này (adapter pattern, câu hỏi mở #2).
- [x] Panel trái: toggle lớp (switch) + đếm số cơ sở; panel phải: pie cơ cấu ngành (conic-gradient) + 4 chỉ số; popup ghim đầy đủ trường (tên, ngành, địa chỉ, lao động, đại diện, SĐT).
- [x] Tọa độ ghim chuẩn hoá % (x,y) trong mock — schema sẵn lat/lng cho provider thật.
