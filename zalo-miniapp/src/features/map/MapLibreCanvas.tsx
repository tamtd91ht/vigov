import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { appConfig } from "@/config/app.config";
import type { MapCanvasProps } from "./MapCanvas";

/**
 * ADAPTER PATTERN — bản đồ nền THẬT cho Mini App, dùng MapLibre GL JS.
 *
 * Nhận đúng bộ `MapCanvasProps` của bản mô phỏng nên `MapPage` chỉ đổi
 * component; hàng chip lớp dữ liệu và bảng chi tiết trượt dưới đáy giữ nguyên.
 * KHÔNG có popup trong khung — trên máy nhỏ popup che gần hết bản đồ, chi tiết
 * ghim vẫn mở ở bảng trượt như trước.
 *
 * BA ĐIỀU KHÁC bản Web Quản trị, đều vì đây là điện thoại:
 *   · ghim to hơn (vừa đầu ngón tay) và không có hiệu ứng hover;
 *   · tắt xoay bằng hai ngón — người dùng hay xoay lệch rồi không biết cách trả lại;
 *   · nạp động `maplibre-gl` để không kéo vài trăm KB vào gói khởi động của
 *     Mini App, thứ ảnh hưởng trực tiếp tới thời gian mở app lần đầu.
 *
 * ĐIỀU KIỆN ĐỂ CHẠY ĐƯỢC TRONG ZALO: tên miền của `styleUrl` phải được khai
 * trong danh sách domain của Mini App trên Zalo Developers. Chưa khai thì tile
 * không tải được và bản đồ chỉ có nền trống — xem docs/03-ZALO-MINIAPP.md.
 */

/** Ghim to hơn bản web: 15px là quá nhỏ cho ngón tay */
const PIN_SIZE = 20;

export function MapLibreCanvas({
  layers,
  pins,
  activeLayerKeys,
  onPinSelect,
  selectedPin,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [failed, setFailed] = useState(false);

  const colorByLayer = new Map(layers.map((l) => [l.key, l.color]));
  const visible = pins.filter((p) => activeLayerKeys.includes(p.layerKey));
  const placeable = visible.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    let created: MapLibreMap | null = null;

    void (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        created = new maplibre.Map({
          container: containerRef.current,
          style: appConfig.map.styleUrl,
          center: [appConfig.map.center.lng, appConfig.map.center.lat],
          zoom: appConfig.map.zoom,
          dragRotate: false,
          pitchWithRotate: false,
          touchZoomRotate: true,
          attributionControl: { compact: true },
        });
        // Xoay bằng hai ngón: dễ vô tình xoay lệch mà không biết cách trả lại
        created.touchZoomRotate.disableRotation();
        created.on("click", () => onPinSelect(null));
        created.on("error", () => setFailed(true));
        mapRef.current = created;
      } catch {
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      created?.remove();
      mapRef.current = null;
    };
    // Cố tình chạy một lần — thay đổi dữ liệu đi qua effect dưới
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    void (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !mapRef.current) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = placeable.map((pin) => {
        const el = document.createElement("div");
        el.className = "map-pin";
        el.setAttribute("aria-label", pin.name);
        el.style.width = `${PIN_SIZE}px`;
        el.style.height = `${PIN_SIZE}px`;
        el.style.background = colorByLayer.get(pin.layerKey) ?? "var(--navy)";
        el.style.borderRadius = "50%";
        el.style.border = "3px solid #fff";
        el.style.boxShadow = "0 2px 6px rgba(0,0,0,.3)";
        /* Marker tự đặt transform để neo toạ độ; lớp .map-pin của bản mô phỏng
           cũng đặt transform nên phải bỏ, nếu không ghim lệch nửa kích thước. */
        el.style.transform = "none";
        el.style.position = "relative";
        /* `.map-pin` dùng margin âm để tự căn giữa trong bản mô phỏng; Marker đã
           căn giữa sẵn nên margin đó làm ghim lệch. */
        el.style.margin = "0";
        if (selectedPin?.id === pin.id) {
          el.style.outline = "3px solid rgba(27,58,92,.35)";
          el.style.outlineOffset = "2px";
        }
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onPinSelect(selectedPin?.id === pin.id ? null : pin);
        });
        return new maplibre.Marker({ element: el, anchor: "center" })
          .setLngLat([pin.lng as number, pin.lat as number])
          .addTo(mapRef.current as MapLibreMap);
      });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, activeLayerKeys, selectedPin]);

  /** Ghim vừa chọn nằm ngoài khung thì đưa vào giữa — bảng chi tiết che mất nửa dưới */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPin || typeof selectedPin.lat !== "number" || typeof selectedPin.lng !== "number") return;
    map.easeTo({ center: [selectedPin.lng, selectedPin.lat], duration: 350 });
  }, [selectedPin]);

  return (
    <div className="mapwrap">
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {failed && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: 16,
            textAlign: "center",
            fontSize: ".82rem",
            color: "var(--slate)",
          }}
        >
          Không tải được bản đồ nền. Kiểm tra kết nối, hoặc tên miền tile chưa được khai trong danh sách
          domain của Mini App.
        </div>
      )}
    </div>
  );
}
