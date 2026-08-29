"use client";

import { useMemo, useState } from "react";
import type { MapPin } from "@/types";
import { appConfig } from "@/config/app.config";
import { Icon } from "@/lib/icons";
import { formatNumber } from "@/lib/format";
import { Chip } from "@/components/ui/Chip";
import { DataState } from "@/components/ui/DataState";
import { PageHead } from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useApiResource } from "@/hooks/useApiResource";
import { fetchMapOverview, fetchMapPins } from "@/services/map.service";
import { MapCanvas } from "./MapCanvas";

/**
 * Trang Bản đồ kinh tế số (WBS #7).
 *
 * Dữ liệu lấy từ API thật: GET /map/overview (lớp + cơ cấu ngành + chỉ số
 * tổng hợp) và GET /map/pins (ghim). Chỉ số nào backend chưa có nguồn dữ liệu
 * sẽ trả null — giao diện hiện dấu gạch kèm ghi chú, KHÔNG hiển thị số ước.
 *
 * Adapter bản đồ được chọn theo appConfig.map.provider (KHÔNG hardcode):
 * hiện mới có adapter "mock" (MapCanvas — bản đồ mô phỏng). Khi khách chốt
 * provider thật (câu hỏi mở #2: VietMap / Goong / MapLibre), thêm adapter
 * cùng props MapCanvasProps và bổ sung nhánh chọn dưới đây — panel lớp dữ
 * liệu và panel phân tích giữ nguyên.
 */
export function MapPage() {
  const { showToast } = useToast();

  const overview = useApiResource(() => fetchMapOverview(), []);
  const pins = useApiResource(() => fetchMapPins(), []);

  const layers = useMemo(() => overview.data?.layers ?? [], [overview.data]);
  const industryStructure = useMemo(() => overview.data?.industryStructure ?? [], [overview.data]);
  const summary = overview.data?.summary ?? [];

  /** null = chưa tải xong lớp dữ liệu, chưa biết lớp nào bật sẵn */
  const [activeLayerIds, setActiveLayerIds] = useState<string[] | null>(null);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState("");

  // Lớp về tới đâu bật mặc định tới đó; tải lại danh sách lớp thì đặt lại lựa chọn
  // (điều chỉnh state ngay trong render — khuôn đã dùng ở các form của dự án)
  const [loadedLayerKey, setLoadedLayerKey] = useState<string | null>(null);
  const layerKey = layers.map((l) => l.id).join(",");
  if (layers.length > 0 && layerKey !== loadedLayerKey) {
    setLoadedLayerKey(layerKey);
    setActiveLayerIds(layers.filter((l) => l.defaultOn).map((l) => l.id));
    setSelectedPin(null);
  }

  const visibleLayerIds = activeLayerIds ?? [];

  const toggleLayer = (layerId: string) => {
    setActiveLayerIds((ids) => {
      const current = ids ?? [];
      return current.includes(layerId) ? current.filter((id) => id !== layerId) : [...current, layerId];
    });
    // Tắt lớp thì đóng popup của ghim thuộc lớp đó
    setSelectedPin((pin) => (pin && pin.layerId === layerId && visibleLayerIds.includes(layerId) ? null : pin));
  };

  const setAllLayers = (on: boolean) => {
    setActiveLayerIds(on ? layers.map((l) => l.id) : []);
    if (!on) setSelectedPin(null);
  };

  /** Điểm dừng conic-gradient cho pie cơ cấu ngành: "màu a% b%, …" */
  const pieStops = useMemo(
    () =>
      industryStructure
        .reduce<{ acc: number; parts: string[] }>(
          (s, c) => ({
            acc: s.acc + c.percent,
            parts: [...s.parts, `${c.color} ${s.acc}% ${s.acc + c.percent}%`],
          }),
          { acc: 0, parts: [] },
        )
        .parts.join(","),
    [industryStructure],
  );

  const handleSelectIndustry = (label: string) => {
    setSelectedIndustry(label);
    if (label) {
      const share = industryStructure.find((c) => c.label === label);
      showToast(`Đang phân tích ngành ${label} — chiếm ${share?.percent ?? 0}% cơ cấu kinh tế`);
    }
  };

  // Câu hỏi mở #10: định dạng & phạm vi xuất dữ liệu bản đồ (Excel/GeoJSON…) chờ khách chốt — hiện mô phỏng bằng toast.
  const handleExport = () => showToast("Đã xuất dữ liệu bản đồ kinh tế số (mô phỏng)");

  const handleCall = (pin: MapPin) => showToast(`Đang kết nối cuộc gọi tới ${pin.representative} — ${pin.phone}`);

  const reloadAll = () => {
    overview.reload();
    pins.reload();
  };

  // Chọn adapter theo provider cấu hình (xem ghi chú đầu file)
  const isMockProvider = appConfig.map.provider === "mock";

  const layerPanel = (
    <div className="mpanel l" onClick={(e) => e.stopPropagation()}>
      <div className="h">Lớp dữ liệu</div>
      <div className="b">
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={`lyr${visibleLayerIds.includes(layer.id) ? " on" : ""}`}
            role="switch"
            aria-checked={visibleLayerIds.includes(layer.id)}
            onClick={() => toggleLayer(layer.id)}
          >
            <span className="dot" style={{ background: layer.color }} />
            <span>{layer.label}</span>
            <span className="n">{formatNumber(layer.count)}</span>
            <span className="sw" />
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--bd)" }}>
          <button type="button" className="btn sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setAllLayers(true)}>
            Bật tất cả
          </button>
          <button type="button" className="btn sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setAllLayers(false)}>
            Tắt tất cả
          </button>
        </div>
      </div>
    </div>
  );

  const analysisPanel = (
    <div className="mpanel r" onClick={(e) => e.stopPropagation()}>
      <div className="h">Phân tích kinh tế</div>
      <div className="b">
        <div className="pie" style={{ background: `conic-gradient(${pieStops})` }} />
        {industryStructure.map((c) => (
          <div
            key={c.label}
            className="pl"
            style={
              selectedIndustry === c.label
                ? { background: "var(--bg2)", borderRadius: 8, padding: "4px 8px", fontWeight: 700 }
                : undefined
            }
          >
            <span className="dot" style={{ background: c.color }} />
            <span>{c.label}</span>
            <span className="n">{c.percent}%</span>
          </div>
        ))}
        <select
          className="sel"
          aria-label="Phân tích theo ngành"
          style={{ width: "100%", marginTop: 10 }}
          value={selectedIndustry}
          onChange={(e) => handleSelectIndustry(e.target.value)}
        >
          <option value="">Phân tích theo ngành</option>
          {industryStructure.map((c) => (
            <option key={c.label} value={c.label}>
              {c.label}
            </option>
          ))}
        </select>
        <div className="mstat">
          {summary.map((s) => (
            <div key={s.label} title={s.note}>
              {/* value = null nghĩa là chưa có nguồn dữ liệu — hiện dấu gạch, không bịa số */}
              <b>{s.value ?? "—"}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="pg" style={{ paddingBottom: 18 }}>
      <PageHead
        title="Bản đồ kinh tế số"
        sub="Cơ sở dữ liệu không gian về doanh nghiệp, hộ kinh doanh và hạ tầng trên địa bàn xã"
        actions={
          <>
            <Chip color="var(--orange)" tint="rgba(230,126,34,.12)" dot>
              Bản đồ mô phỏng — provider thật (VietMap/Goong/MapLibre) chờ khách chốt
            </Chip>
            <button type="button" className="btn pri" onClick={handleExport}>
              <Icon name="down" size={15} />
              Xuất dữ liệu
            </button>
          </>
        }
      />
      <DataState
        loading={overview.loading || pins.loading}
        error={overview.error ?? pins.error}
        onRetry={reloadAll}
        empty={layers.length === 0}
        emptyMessage="Chưa có lớp dữ liệu bản đồ — chạy seed hoặc thêm lớp trong phần quản trị"
      >
        {isMockProvider ? (
          <MapCanvas
            layers={layers}
            pins={pins.data ?? []}
            activeLayerIds={visibleLayerIds}
            onPinSelect={setSelectedPin}
            selectedPin={selectedPin}
            onCall={handleCall}
          >
            {layerPanel}
            {analysisPanel}
          </MapCanvas>
        ) : (
          <div className="mapwrap" style={{ display: "grid", placeItems: "center" }}>
            <div className="muted" style={{ fontSize: 13, textAlign: "center", padding: 20 }}>
              <Icon name="map" size={28} />
              <div style={{ marginTop: 8 }}>
                Adapter cho provider “{appConfig.map.provider}” chưa được tích hợp — chờ chốt câu hỏi mở #2.
              </div>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
