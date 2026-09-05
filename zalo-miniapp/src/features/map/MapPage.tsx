import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { DataState } from "@/components/DataState";
import { DemoNote, formatNumber, IconBubble, SubHeader, tint } from "@/components/common";
import { appConfig } from "@/config/app.config";
import { demoConfig } from "@/config/demo.config";
import { useApiResource } from "@/hooks/useApiResource";
import { mapService } from "@/services/map.service";
import type { MapPin } from "@/types";
import { MapCanvas } from "./MapCanvas";

const PAGE_TITLE = "Bản đồ kinh tế số";
const EMPTY_MESSAGE = "Xã chưa công bố dữ liệu bản đồ kinh tế.";
const HINT = "Chạm vào một điểm trên bản đồ để xem thông tin cơ sở.";

/** Nhãn số lao động — công trình chưa vận hành thì không hiện số 0 vô nghĩa */
function workersLabel(workers: number): string {
  return workers > 0 ? `${formatNumber(workers)} lao động` : "Chưa có lao động thường xuyên";
}

export function MapPage() {
  const map = useApiResource(() => mapService.economy(), []);
  const [activeKeys, setActiveKeys] = useState<string[] | null>(null);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);

  /* Lớp bật sẵn do backend quyết định (MapLayer.defaultOn), chỉ áp một lần khi
     dữ liệu về — sau đó người dùng tự bật/tắt, không ghi đè lựa chọn của họ. */
  useEffect(() => {
    if (!map.data || activeKeys !== null) return;
    setActiveKeys(map.data.layers.filter((l) => l.defaultOn).map((l) => l.key));
  }, [map.data, activeKeys]);

  const keys = activeKeys ?? [];

  const toggleLayer = (key: string) => {
    setActiveKeys((prev) => {
      const current = prev ?? [];
      return current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    });
    /* Tắt lớp của ghim đang mở thì bảng chi tiết phải đóng theo, không thì nó
       treo lại mô tả một điểm đã biến mất khỏi bản đồ. */
    setSelectedPin(null);
  };

  const visiblePins = useMemo(
    () => (map.data ? map.data.pins.filter((p) => keys.includes(p.layerKey)) : []),
    [map.data, keys],
  );

  const totalWorkers = useMemo(
    () => visiblePins.reduce((sum, p) => sum + p.workers, 0),
    [visiblePins],
  );

  const selectedLayer = selectedPin
    ? map.data?.layers.find((l) => l.key === selectedPin.layerKey)
    : undefined;
  const selectedColor = selectedLayer?.color ?? "var(--slate)";

  return (
    <div className="app">
      <SubHeader title={PAGE_TITLE} />

      <div className="page plain">
        <DemoNote>{demoConfig.notes.map}</DemoNote>
        <div className="tiny muted" style={{ marginBottom: 12 }}>
          {appConfig.org.name} · {appConfig.org.parent}
        </div>

        <DataState
          loading={map.loading}
          error={map.error}
          onRetry={map.reload}
          empty={!!map.data && map.data.pins.length === 0}
          emptyIcon="map"
          emptyMessage={EMPTY_MESSAGE}
        >
          {map.data && (
            <>
              {/* Chip bật/tắt lớp — cuộn ngang thay cho panel trái của Web Quản trị */}
              <div className="chips-row" style={{ marginBottom: 12 }}>
                {map.data.layers.map((layer) => {
                  const on = keys.includes(layer.key);
                  return (
                    <button
                      key={layer.key}
                      className={on ? "fchip on" : "fchip"}
                      style={
                        on
                          ? { background: layer.color, borderColor: layer.color, color: "#fff" }
                          : undefined
                      }
                      onClick={() => toggleLayer(layer.key)}
                      aria-pressed={on}
                    >
                      <span
                        className="map-dot"
                        style={{ background: on ? "rgba(255,255,255,.85)" : layer.color }}
                      />
                      {layer.label}
                      <span style={{ opacity: 0.75, marginLeft: 4 }}>{layer.count}</span>
                    </button>
                  );
                })}
              </div>

              <MapCanvas
                layers={map.data.layers}
                pins={map.data.pins}
                activeLayerKeys={keys}
                onPinSelect={setSelectedPin}
                selectedPin={selectedPin}
              />

              {/* Hai chỉ số tổng hợp, tính theo đúng các lớp đang bật */}
              <div className="grid2" style={{ marginTop: 12 }}>
                <div className="card card-b">
                  <div className="map-stat">{formatNumber(visiblePins.length)}</div>
                  <div className="tiny muted">Cơ sở đang hiển thị</div>
                </div>
                <div className="card card-b">
                  <div className="map-stat">{formatNumber(totalWorkers)}</div>
                  <div className="tiny muted">Lao động</div>
                </div>
              </div>

              <div className="tiny muted" style={{ marginTop: 12, textAlign: "center" }}>
                {HINT}
              </div>
            </>
          )}
        </DataState>
      </div>

      {/* Bảng chi tiết trượt từ đáy — thay cho popup trong khung của bản Web */}
      {selectedPin && (
        <>
          <div className="map-scrim" onClick={() => setSelectedPin(null)} />
          <div className="map-sheet" role="dialog" aria-label={selectedPin.name}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <IconBubble name="pin" color={selectedColor} size={42} iconSize={21} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "var(--navy)" }}>{selectedPin.name}</div>
                <span
                  className="chip"
                  style={{
                    background: tint(selectedColor, 0.14),
                    color: selectedColor,
                    marginTop: 4,
                  }}
                >
                  {selectedLayer?.label ?? "Cơ sở"}
                </span>
              </div>

              <button className="map-close" onClick={() => setSelectedPin(null)} aria-label="Đóng">
                <Icon name="close" size={19} />
              </button>
            </div>

            <div className="map-rows">
              {selectedPin.industry && (
                <div className="map-row">
                  <Icon name="build" size={16} />
                  <span>{selectedPin.industry}</span>
                </div>
              )}
              {selectedPin.address && (
                <div className="map-row">
                  <Icon name="pin" size={16} />
                  <span>{selectedPin.address}</span>
                </div>
              )}
              <div className="map-row">
                <Icon name="user" size={16} />
                <span>{workersLabel(selectedPin.workers)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
