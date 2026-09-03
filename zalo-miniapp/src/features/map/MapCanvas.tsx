import type { CSSProperties } from "react";
import type { MapLayer, MapPin } from "@/types";

/**
 * ADAPTER PATTERN — bản đồ mô phỏng cho Mini App (provider "mock").
 *
 * Song song với admin-web/src/features/map/MapCanvas.tsx nhưng dựng riêng cho
 * màn hình điện thoại: nền đơn giản hơn, ghim to hơn cho vừa đầu ngón tay,
 * và KHÔNG có popup trong khung — chi tiết ghim mở ở bảng trượt dưới đáy màn
 * (MapPage), vì popup trong khung sẽ che gần hết bản đồ trên máy nhỏ.
 *
 * Khi khách chốt provider thật (VietMap / Goong / MapLibre — câu hỏi mở #2),
 * viết adapter mới nhận CÙNG bộ MapCanvasProps, dùng pin.lat/lng thay cho
 * x/y, rồi chọn adapter theo appConfig.map.provider tại MapPage. Trang, hàng
 * chip lớp và bảng chi tiết không phải sửa gì.
 */
export interface MapCanvasProps {
  /** Danh sách lớp — tra màu cho ghim */
  layers: MapLayer[];
  /** Toàn bộ ghim; canvas tự lọc theo lớp đang bật */
  pins: MapPin[];
  /** Khoá các lớp đang bật */
  activeLayerKeys: string[];
  /** Chọn ghim (null = bỏ chọn) */
  onPinSelect: (pin: MapPin | null) => void;
  /** Ghim đang được chọn */
  selectedPin: MapPin | null;
}

/* Nền mô phỏng — cùng bố cục địa hình với bản đồ Web Quản trị để hai bên
   nhìn ra cùng một địa bàn, lược bớt chi tiết cho vừa màn hình nhỏ. */
const BLOCKS: CSSProperties[] = [
  { left: "6%", top: "12%", width: "28%", height: "20%" },
  { left: "58%", top: "16%", width: "30%", height: "18%" },
  { left: "10%", top: "60%", width: "26%", height: "24%" },
  { left: "58%", top: "62%", width: "30%", height: "22%" },
];

const ROADS: CSSProperties[] = [
  { left: 0, right: 0, top: "46%", height: 10 },
  { top: 0, bottom: 0, left: "44%", width: 9 },
  { left: 0, right: 0, top: "78%", height: 6 },
];

const PLACE_LABELS: { style: CSSProperties; text: string }[] = [
  { style: { left: "16%", top: "5%" }, text: "THÔN ĐÔNG" },
  { style: { left: "64%", top: "8%" }, text: "THÔN ĐOÀI" },
  { style: { left: "12%", top: "90%" }, text: "THÔN TRUNG" },
  { style: { left: "60%", top: "90%" }, text: "TDP SỐ 5" },
];

export function MapCanvas({ layers, pins, activeLayerKeys, onPinSelect, selectedPin }: MapCanvasProps) {
  const colorOf = new Map(layers.map((l) => [l.key, l.color]));
  const visiblePins = pins.filter((p) => activeLayerKeys.includes(p.layerKey));

  return (
    <div
      className="mapwrap"
      /* Bấm vào nền để bỏ chọn ghim — người dùng đóng bảng chi tiết mà không
         phải với tới nút đóng ở góc. */
      onClick={() => onPinSelect(null)}
    >
      <div className="map-river" />
      {BLOCKS.map((style, i) => (
        <div key={`b${i}`} className="map-block" style={style} />
      ))}
      {ROADS.map((style, i) => (
        <div key={`r${i}`} className="map-road" style={style} />
      ))}
      {PLACE_LABELS.map((label) => (
        <span key={label.text} className="map-place" style={label.style}>
          {label.text}
        </span>
      ))}

      {visiblePins.map((pin) => {
        const color = colorOf.get(pin.layerKey) ?? "var(--slate)";
        const active = selectedPin?.id === pin.id;
        return (
          <button
            key={pin.id}
            className={active ? "map-pin on" : "map-pin"}
            style={{ left: `${pin.x}%`, top: `${pin.y}%`, background: color }}
            aria-label={pin.name}
            onClick={(e) => {
              /* Chặn nổi bọt: nếu không, cú bấm chạy tiếp lên nền và bỏ chọn
                 ngay chính ghim vừa chọn. */
              e.stopPropagation();
              onPinSelect(active ? null : pin);
            }}
          />
        );
      })}

      {visiblePins.length === 0 && <div className="map-none">Chưa bật lớp dữ liệu nào</div>}
    </div>
  );
}
