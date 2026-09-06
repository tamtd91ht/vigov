"use client";

import { Icon } from "@/lib/icons";
import type { MapLayer, MapPin } from "@/types";

/**
 * Nội dung popup của một ghim trên bản đồ.
 *
 * VÌ SAO TÁCH RA: có HAI adapter bản đồ (bản mô phỏng `MapCanvas` và bản đồ
 * thật `MapLibreCanvas`) và cả hai phải hiện đúng một nội dung. Để mỗi adapter
 * tự dựng popup là chắc chắn hai bên lệch nhau sau vài lần sửa.
 *
 * Component này KHÔNG tự định vị: adapter bọc nó trong `.pop` rồi đặt vị trí
 * theo cách của mình (phần trăm khung với bản mô phỏng, pixel chiếu từ toạ độ
 * với bản đồ thật).
 */
export function PinPopupContent({
  pin,
  layer,
  onClose,
  onCall,
}: {
  pin: MapPin;
  layer: MapLayer;
  onClose: () => void;
  onCall?: (pin: MapPin) => void;
}) {
  return (
    <>
      <div className="h">
        <span className="dot" style={{ background: layer.color, marginTop: 5 }} />
        <div>
          <b>{pin.name}</b>
          <div className="tiny muted">{layer.label}</div>
        </div>
        <button
          type="button"
          className="icbtn"
          aria-label="Đóng"
          style={{ width: 26, height: 26, marginLeft: "auto", border: "none" }}
          onClick={onClose}
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="b">
        <div className="r">
          <span className="k">Ngành nghề</span>
          <span>{pin.industry}</span>
        </div>
        <div className="r">
          <span className="k">Địa chỉ</span>
          <span>{pin.address}</span>
        </div>
        <div className="r">
          <span className="k">Số lao động</span>
          <span>{pin.workers > 0 ? `${pin.workers} người` : "Không áp dụng"}</span>
        </div>
        <div className="r">
          <span className="k">Đại diện</span>
          <span>{pin.representative}</span>
        </div>
        <div className="r">
          <span className="k">Điện thoại</span>
          <span>{pin.phone}</span>
        </div>
        <button
          type="button"
          className="btn sm"
          style={{ marginTop: 4, justifyContent: "center" }}
          onClick={() => onCall?.(pin)}
        >
          <Icon name="phone" size={14} />
          Gọi {pin.phone}
        </button>
      </div>
    </>
  );
}
