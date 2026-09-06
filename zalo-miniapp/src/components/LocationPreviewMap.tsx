import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { appConfig } from "@/config/app.config";

/**
 * Bản đồ nhỏ xem trước MỘT vị trí trong Mini App.
 *
 * Dùng ở bước 2 của luồng gửi phản ánh: người dân cần THẤY điểm mình đang báo
 * nằm ở đâu, chứ một dòng toạ độ "20.693500, 105.928500" thì không ai kiểm tra
 * được là đúng hay sai. Đây cũng là chỗ dễ sai nhất của cả phiếu — GPS lệch vài
 * trăm mét là cán bộ tới nhầm nơi.
 *
 * BA QUYẾT ĐỊNH cho màn hình điện thoại:
 *   · TẮT mọi tương tác (kéo, thu phóng, chạm hai ngón). Bản đồ nằm giữa một
 *     trang cuộn dọc; để nó bắt cử chỉ là người dùng không cuộn qua được nó.
 *   · Toạ độ đổi (bấm định vị lại) thì chỉ `jumpTo`, KHÔNG dựng lại bản đồ —
 *     dựng lại là tải lại toàn bộ tile, tốn dữ liệu di động vô ích.
 *   · Không có toạ độ thì trả `null`: thà không hiện gì còn hơn hiện một bản đồ
 *     ở toạ độ 0,0 giữa đại dương.
 */

/** Zoom đủ gần để nhận ra ngõ, nhà, mốc quen thuộc */
const PREVIEW_ZOOM = 17;

export function LocationPreviewMap({
  lat,
  lng,
  height = 150,
}: {
  lat?: number;
  lng?: number;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [failed, setFailed] = useState(false);

  const hasPoint = typeof lat === "number" && typeof lng === "number";
  const useRealMap = appConfig.map.provider !== "mock";

  useEffect(() => {
    if (!useRealMap || !hasPoint || !containerRef.current) return;

    // Bản đồ đã dựng: chỉ nhảy tới toạ độ mới, không dựng lại
    if (mapRef.current) {
      mapRef.current.jumpTo({ center: [lng as number, lat as number], zoom: PREVIEW_ZOOM });
      markerRef.current?.setLngLat([lng as number, lat as number]);
      return;
    }

    let cancelled = false;
    let created: MapLibreMap | null = null;

    void (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;

        created = new maplibre.Map({
          container: containerRef.current,
          style: appConfig.map.styleUrl,
          center: [lng as number, lat as number],
          zoom: PREVIEW_ZOOM,
          interactive: false,
          attributionControl: { compact: true },
        });
        created.on("error", () => setFailed(true));

        const el = document.createElement("div");
        el.style.width = "22px";
        el.style.height = "22px";
        el.style.borderRadius = "50%";
        el.style.background = "var(--pink)";
        el.style.border = "3px solid #fff";
        el.style.boxShadow = "0 2px 8px rgba(0,0,0,.35)";
        markerRef.current = new maplibre.Marker({ element: el, anchor: "center" })
          .setLngLat([lng as number, lat as number])
          .addTo(created);

        mapRef.current = created;
      } catch {
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lat, lng, hasPoint, useRealMap]);

  // Dọn bản đồ khi component biến mất (tách khỏi effect trên để đổi toạ độ không phá map)
  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    },
    [],
  );

  if (!useRealMap || !hasPoint) return null;

  return (
    <div
      style={{
        position: "relative",
        height,
        marginTop: 10,
        borderRadius: "var(--radius)",
        overflow: "hidden",
        border: "1px solid var(--line)",
        background: "var(--bg-soft)",
      }}
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {failed && (
        <div
          className="tiny muted"
          style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", padding: 12 }}
        >
          Không tải được bản đồ nền
        </div>
      )}
    </div>
  );
}
