"use client";

import { useEffect, useRef, useState } from "react";
/* CSS của MapLibre (nút thu phóng, thanh tỉ lệ, dòng ghi công). Nhập tĩnh
   được vì tệp này chỉ được trang Bản đồ nhập — không lọt vào bundle trang khác. */
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, Marker, StyleSpecification } from "maplibre-gl";
import { appConfig } from "@/config/app.config";
import { Icon } from "@/lib/icons";
import type { MapPin } from "@/types";
import type { MapCanvasProps } from "./MapCanvas";
import { PinPopupContent } from "./PinPopupContent";

/**
 * ADAPTER PATTERN — bản đồ nền THẬT bằng MapLibre GL JS.
 *
 * Nhận đúng bộ props `MapCanvasProps` của bản mô phỏng (`MapCanvas`), nên
 * `MapPage` chỉ đổi component chứ không sửa gì về dữ liệu hay hai panel phủ.
 *
 * NGUỒN TILE mặc định là OpenFreeMap (`NEXT_PUBLIC_MAP_STYLE_URL`): không cần
 * khoá API, không giới hạn lượt xem, dữ liệu OpenStreetMap. Đổi sang VietMap /
 * Goong / nguồn tự dựng chỉ cần đổi biến môi trường đó — miễn là style theo
 * chuẩn MapLibre. Xem thêm phần Bản đồ trong docs/02-ADMIN-WEB.md.
 *
 * NẠP ĐỘNG có chủ ý: `maplibre-gl` nặng vài trăm KB, mà chỉ đúng một phân hệ
 * dùng tới. Nạp tĩnh là mọi trang khác đều phải tải theo.
 */

/** Zoom mặc định khi mở trang — đủ thấy trọn địa bàn một xã */
const DEFAULT_ZOOM = 14;
/** Zoom khi bấm vào một ghim từ danh sách */
const FOCUS_ZOOM = 16;

/** Đường kính ghim (px) — khớp `.pin` trong globals.css */
const PIN_SIZE = 15;

export function MapLibreCanvas({
  layers,
  pins,
  activeLayerIds,
  onPinSelect,
  selectedPin,
  onCall,
  children,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  /** Vị trí pixel của popup, chiếu lại mỗi khi bản đồ di chuyển */
  const [popupAt, setPopupAt] = useState<{ x: number; y: number } | null>(null);
  const [failed, setFailed] = useState(false);

  const layerById = new Map(layers.map((l) => [l.id, l]));
  const selectedLayer = selectedPin ? layerById.get(selectedPin.layerId) : undefined;

  /* Ghim không có toạ độ thật thì không đặt được lên bản đồ nền. Dữ liệu seed
     đã sinh lat/lng tất định từ x/y, nhưng dữ liệu do người dùng thêm sau có
     thể thiếu — lọc ra và nói rõ số lượng thay vì đặt sai chỗ. */
  const visible = pins.filter((p) => activeLayerIds.includes(p.layerId));
  const placeable = visible.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
  const missingCoords = visible.length - placeable.length;

  // ─── Khởi tạo bản đồ một lần ───────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let cancelled = false;
    let created: MapLibreMap | null = null;

    void (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;

        created = new maplibre.Map({
          container: containerRef.current,
          style: appConfig.map.styleUrl as string | StyleSpecification,
          center: [appConfig.map.center.lng, appConfig.map.center.lat],
          zoom: appConfig.map.zoom ?? DEFAULT_ZOOM,
          // Bản đồ hành chính: xoay/nghiêng chỉ gây mất phương hướng
          pitchWithRotate: false,
          dragRotate: false,
          attributionControl: { compact: true },
        });
        created.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-right");
        created.addControl(new maplibre.ScaleControl({ unit: "metric" }), "bottom-left");
        // Bấm ra vùng trống thì đóng popup, giống hành vi bản mô phỏng
        created.on("click", () => onPinSelect(null));
        created.on("error", () => setFailed(true));
        mapRef.current = created;
      } catch {
        // Không tải được thư viện (mạng chặn CDN nội bộ, chunk lỗi) — báo dịu, không làm trắng trang
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
    // Cố tình chạy MỘT lần: bản đồ tự sống, các thay đổi khác đi qua effect dưới
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Vẽ lại ghim khi dữ liệu hoặc lớp đang bật đổi ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    void (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !mapRef.current) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = placeable.map((pin) => {
        const el = document.createElement("div");
        el.className = "pin";
        el.title = pin.name;
        el.style.background = layerById.get(pin.layerId)?.color ?? "var(--blue)";
        el.style.width = `${PIN_SIZE}px`;
        el.style.height = `${PIN_SIZE}px`;
        /* Marker của MapLibre tự đặt transform để neo vào toạ độ; `.pin` cũng
           đặt transform (translate(-50%,-50%)) nên phải bỏ, nếu không ghim lệch
           đúng nửa kích thước và hiệu ứng hover kéo nó đi. */
        el.style.position = "relative";
        el.style.transform = "none";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onPinSelect(pin === selectedPin ? null : pin);
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
  }, [pins, activeLayerIds, selectedPin]);

  // ─── Bám popup theo ghim đang chọn ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPin || typeof selectedPin.lat !== "number" || typeof selectedPin.lng !== "number") {
      setPopupAt(null);
      return;
    }

    const lngLat: [number, number] = [selectedPin.lng, selectedPin.lat];
    const reproject = () => {
      const point = map.project(lngLat);
      setPopupAt({ x: point.x, y: point.y });
    };
    reproject();
    // Kéo/thu phóng làm pixel đổi trong khi toạ độ không đổi → phải chiếu lại
    map.on("move", reproject);
    map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), FOCUS_ZOOM), duration: 400 });

    return () => {
      map.off("move", reproject);
    };
  }, [selectedPin]);

  return (
    <div className="mapwrap" onClick={() => onPinSelect(null)}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {failed && (
        <div
          className="muted"
          style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", padding: 20 }}
        >
          <div>
            <Icon name="map" size={28} />
            <div style={{ marginTop: 8, fontSize: 13 }}>
              Không tải được bản đồ nền từ {hostOf(appConfig.map.styleUrl)}. Kiểm tra đường truyền hoặc
              đặt <code>NEXT_PUBLIC_MAP_PROVIDER=mock</code> để dùng bản mô phỏng.
            </div>
          </div>
        </div>
      )}

      {missingCoords > 0 && !failed && (
        <div
          className="tiny"
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            zIndex: 6,
            background: "rgba(255,255,255,.92)",
            border: "1px solid var(--bd)",
            borderRadius: 8,
            padding: "6px 10px",
            color: "var(--mut)",
          }}
        >
          {missingCoords} ghim chưa có toạ độ nên không hiện trên bản đồ
        </div>
      )}

      {selectedPin && selectedLayer && popupAt && (
        <div
          className="pop"
          style={{ left: popupAt.x, top: popupAt.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <PinPopupContent
            pin={selectedPin as MapPin}
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

/** Tên miền của URL style — hiện trong thông báo lỗi cho dễ gỡ rối */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
