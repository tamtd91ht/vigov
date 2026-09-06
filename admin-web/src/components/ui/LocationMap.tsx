"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { appConfig } from "@/config/app.config";
import { Icon } from "@/lib/icons";

/**
 * Bản đồ nhỏ hiển thị MỘT vị trí — dùng cho ngăn chi tiết phản ánh, và bất kỳ
 * chỗ nào cần "đây là điểm được nói tới" chứ không phải một bản đồ để khám phá.
 *
 * KHÁC `MapLibreCanvas` ở ba điểm, đều vì nó nằm trong một ngăn trượt:
 *   · TẮT thu phóng bằng con lăn — nếu không, người dùng cuộn ngăn chi tiết mà
 *     con trỏ đi qua bản đồ là bản đồ hút mất cú cuộn, ngăn đứng im. Đây là lỗi
 *     kinh điển của bản đồ nhúng, phải chặn ngay từ đầu.
 *   · Không có nút thu phóng, không có thanh tỉ lệ: khung 180px không đủ chỗ.
 *   · Chỉ một ghim, và ghim luôn ở giữa.
 *
 * Không có toạ độ thì component trả `null` để nơi gọi tự quyết định hiển thị gì
 * (thường là quay về khối mô phỏng cũ) — không tự vẽ một bản đồ ở toạ độ 0,0.
 */

/** Zoom đủ gần để thấy đường và khối nhà quanh điểm */
const POINT_ZOOM = 16;

/** Ngưỡng coi như hỏng nếu style chưa nạp xong (giống MapLibreCanvas) */
const STYLE_LOAD_TIMEOUT_MS = 12_000;

export function LocationMap({
  lat,
  lng,
  color,
  label,
  height = 180,
}: {
  lat?: number;
  lng?: number;
  /** Màu ghim — thường là màu lĩnh vực phản ánh */
  color: string;
  /** Nhãn hiện dưới đáy khung: thôn/tổ dân phố hoặc địa chỉ */
  label?: string;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [failed, setFailed] = useState(false);

  const hasPoint = typeof lat === "number" && typeof lng === "number";

  useEffect(() => {
    if (!hasPoint || !containerRef.current || mapRef.current) return;

    let cancelled = false;
    let created: MapLibreMap | null = null;

    void (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;

        created = new maplibre.Map({
          container: containerRef.current,
          style: appConfig.map.styleUrl as string | StyleSpecification,
          center: [lng as number, lat as number],
          zoom: POINT_ZOOM,
          // Xem một điểm thì không cần xoay/nghiêng
          dragRotate: false,
          pitchWithRotate: false,
          // Xem ghi chú đầu tệp: con lăn phải thuộc về ngăn trượt, không phải bản đồ
          scrollZoom: false,
          attributionControl: { compact: true },
        });
        created.on("error", () => setFailed(true));

        const el = document.createElement("div");
        el.className = "pin";
        el.style.background = color;
        el.style.width = "17px";
        el.style.height = "17px";
        el.style.transform = "none";
        el.style.position = "relative";
        new maplibre.Marker({ element: el, anchor: "center" })
          .setLngLat([lng as number, lat as number])
          .addTo(created);

        mapRef.current = created;

        const guard = window.setTimeout(() => {
          if (mapRef.current && !mapRef.current.isStyleLoaded()) setFailed(true);
        }, STYLE_LOAD_TIMEOUT_MS);
        created.once("styledata", () => window.clearTimeout(guard));
      } catch {
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      created?.remove();
      mapRef.current = null;
    };
    // Toạ độ của một phiếu không đổi trong lúc mở ngăn; đổi phiếu thì key đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  if (!hasPoint) return null;

  return (
    <div
      style={{
        position: "relative",
        height,
        borderRadius: 10,
        border: "1px solid var(--bd)",
        overflow: "hidden",
        background: "var(--bg2)",
      }}
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {failed && (
        <div
          className="tiny muted"
          style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", padding: 12 }}
        >
          <span>
            <Icon name="map" size={20} />
            <br />
            Không tải được bản đồ nền
          </span>
        </div>
      )}

      {label && !failed && (
        <div
          className="tiny"
          style={{
            position: "absolute",
            left: 8,
            bottom: 8,
            zIndex: 3,
            background: "rgba(255,255,255,.92)",
            border: "1px solid var(--bd)",
            borderRadius: 7,
            padding: "4px 8px",
            maxWidth: "70%",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
