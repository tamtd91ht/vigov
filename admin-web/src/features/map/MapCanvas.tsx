"use client";

import type { CSSProperties, ReactNode } from "react";
import type { MapLayer, MapPin } from "@/types";
import { PinPopupContent } from "./PinPopupContent";

/**
 * ADAPTER PATTERN — bản đồ mô phỏng (provider "mock").
 *
 * MapCanvas là adapter mặc định khi appConfig.map.provider === "mock":
 * vẽ nền địa hình giả lập (đường, sông, khối dân cư, nhãn địa danh) và
 * đặt ghim theo toạ độ % (pin.x / pin.y) trong khung .mapwrap.
 *
 * Câu hỏi mở #2: khách chưa chốt provider bản đồ thật (VietMap / Goong /
 * MapLibre). Khi chốt, viết adapter mới (vd. VietMapCanvas) nhận CÙNG bộ
 * props MapCanvasProps — dùng pin.lat/lng thay cho x/y, render marker và
 * popup bằng SDK của provider — rồi chọn adapter theo appConfig.map.provider
 * tại MapPage. Trang và 2 panel không phải sửa gì.
 */
export interface MapCanvasProps {
  /** Danh sách lớp — tra màu & tên lớp cho ghim/popup */
  layers: MapLayer[];
  /** Toàn bộ ghim; canvas tự lọc theo lớp đang bật */
  pins: MapPin[];
  /** Id các lớp đang bật */
  activeLayerIds: string[];
  /** Chọn ghim (null = bỏ chọn / đóng popup) */
  onPinSelect: (pin: MapPin | null) => void;
  /** Ghim đang mở popup */
  selectedPin: MapPin | null;
  /** Bấm nút gọi trong popup */
  onCall?: (pin: MapPin) => void;
  /** Lớp phủ đặt trong khung bản đồ (panel trái/phải…) */
  children?: ReactNode;
}

/* Nền mô phỏng — toạ độ tái tạo trung thực từ prototype (renderMap) */
const BLOCKS: CSSProperties[] = [
  { left: "8%", top: "12%", width: "26%", height: "22%" },
  { left: "56%", top: "16%", width: "30%", height: "20%" },
  { left: "12%", top: "58%", width: "24%", height: "26%" },
  { left: "58%", top: "60%", width: "28%", height: "24%" },
];

const RIVERS: CSSProperties[] = [
  { left: "-4%", top: "8%", width: "110%", height: 16, transform: "rotate(-4deg)" },
];

const ROADS: CSSProperties[] = [
  { left: 0, right: 0, top: "46%", height: 14 },
  { top: 0, bottom: 0, left: "44%", width: 12 },
  { left: 0, right: 0, top: "78%", height: 8 },
  { top: 0, bottom: 0, left: "76%", width: 8 },
];

const PLACE_LABELS: { style: CSSProperties; text: string }[] = [
  { style: { left: "20%", top: "8%" }, text: "THÔN ĐÔNG" },
  { style: { left: "66%", top: "12%" }, text: "THÔN ĐOÀI" },
  { style: { left: "18%", top: "88%" }, text: "THÔN TRUNG" },
  { style: { left: "62%", top: "88%" }, text: "TỔ DÂN PHỐ SỐ 5" },
  { style: { left: "45.5%", top: "43%", color: "#9AA8B6" }, text: "Đường liên xã ĐT-428" },
];

/** Ghim ở sát mép trên (y < ngưỡng %) thì lật popup xuống dưới để không tràn khung */
const POPUP_BELOW_THRESHOLD_PCT = 30;

export function MapCanvas({ layers, pins, activeLayerIds, onPinSelect, selectedPin, onCall, children }: MapCanvasProps) {
  const layerById = new Map(layers.map((l) => [l.id, l]));
  const visiblePins = pins.filter((p) => activeLayerIds.includes(p.layerId));
  const selectedLayer = selectedPin ? layerById.get(selectedPin.layerId) : undefined;

  return (
    <div className="mapwrap" onClick={() => onPinSelect(null)}>
      {BLOCKS.map((style, i) => (
        <div key={`blk-${i}`} className="blk" style={style} />
      ))}
      {RIVERS.map((style, i) => (
        <div key={`river-${i}`} className="river" style={style} />
      ))}
      {ROADS.map((style, i) => (
        <div key={`road-${i}`} className="road" style={style} />
      ))}
      {PLACE_LABELS.map((l) => (
        <div key={l.text} className="mlbl" style={l.style}>
          {l.text}
        </div>
      ))}

      {visiblePins.map((pin) => (
        <div
          key={`${pin.layerId}-${pin.name}`}
          className="pin"
          role="button"
          aria-label={pin.name}
          title={pin.name}
          style={{ left: `${pin.x}%`, top: `${pin.y}%`, background: layerById.get(pin.layerId)?.color }}
          onClick={(e) => {
            e.stopPropagation();
            onPinSelect(pin === selectedPin ? null : pin);
          }}
        />
      ))}

      {selectedPin && selectedLayer && (
        <div
          className={`pop${selectedPin.y < POPUP_BELOW_THRESHOLD_PCT ? " below" : ""}`}
          style={{ left: `${selectedPin.x}%`, top: `${selectedPin.y}%` }}
          onClick={(e) => e.stopPropagation()}
        >
          <PinPopupContent
            pin={selectedPin}
            layer={selectedLayer}
            onClose={() => onPinSelect(null)}
            onCall={onCall}
          />
        </div>
      )}

      {children}
    </div>
  );
}
