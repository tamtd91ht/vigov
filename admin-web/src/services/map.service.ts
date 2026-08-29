import { apiClient, ApiError, buildQuery } from "./api";
import { appConfig } from "@/config/app.config";
import { formatNumber } from "@/lib/format";
import { economySummary, industryStructure as mockIndustry, mapLayers, mapPins } from "@/mocks/map";
import type { MapLayer, MapPin } from "@/types";

/**
 * Phân hệ Bản đồ kinh tế số (WBS #7).
 *
 * Backend đặt tên khoá lớp là `key` / `layerKey`; giao diện (MapCanvas và các
 * panel) đã dùng `id` / `layerId` từ mockup nên service ánh xạ ngay tại đây —
 * nhờ đó đổi sang API thật không phải sửa component nào.
 *
 * Đường lui mock (@/mocks/map) giữ nguyên cho chế độ demo.
 */

/** Lớp dữ liệu kèm mã bản ghi để sửa/xoá */
export interface MapLayerRecord extends MapLayer {
  /** _id trong MongoDB — dùng cho PATCH /map/layers/:id */
  recordId: string;
  order: number;
}

/** Ghim kèm mã bản ghi để sửa/xoá */
export interface MapPinRecord extends MapPin {
  /** _id trong MongoDB — dùng cho PATCH/DELETE /map/pins/:id */
  recordId: string;
}

/** Một lát cắt cơ cấu kinh tế theo ngành */
export interface IndustryShare {
  label: string;
  percent: number;
  color: string;
  /** Số cơ sở thuộc nhóm ngành (chỉ có ở dữ liệu thật) */
  count?: number;
}

/**
 * Một chỉ số tổng hợp trên panel phân tích.
 * `value === null` nghĩa là CHƯA CÓ NGUỒN DỮ LIỆU — giao diện hiển thị dấu
 * gạch kèm `note`, tuyệt đối không hiển thị số ước lượng.
 */
export interface EconomySummaryItem {
  value: string | null;
  label: string;
  note?: string;
}

export interface MapOverview {
  layers: MapLayerRecord[];
  industryStructure: IndustryShare[];
  summary: EconomySummaryItem[];
}

/** Trường được phép gửi khi thêm / sửa ghim */
export interface MapPinInput {
  layerId?: string;
  name?: string;
  industry?: string;
  address?: string;
  workers?: number;
  representative?: string;
  phone?: string;
  x?: number;
  y?: number;
  lat?: number;
  lng?: number;
}

/** Trường được phép gửi khi thêm / sửa lớp dữ liệu */
export interface MapLayerInput {
  id?: string;
  label?: string;
  color?: string;
  defaultOn?: boolean;
  order?: number;
}

/* ── Kiểu dữ liệu backend trả về ─────────────────────────────────────────── */

interface ApiLayer {
  _id: string;
  key: string;
  label: string;
  color: string;
  defaultOn: boolean;
  order: number;
  count: number;
}

interface ApiPin {
  _id: string;
  layerKey: string;
  name: string;
  industry: string;
  address: string;
  workers: number;
  representative: string;
  phone: string;
  x: number;
  y: number;
  lat?: number;
  lng?: number;
}

interface ApiSummaryItem {
  value: number | null;
  label: string;
  note?: string;
}

interface ApiOverview {
  layers: ApiLayer[];
  industryStructure: IndustryShare[];
  summary: ApiSummaryItem[];
}

interface ListResponse<T> {
  items: T[];
  total: number;
}

function mockDelay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), appConfig.api.mockDelayMs));
}

function toLayer(row: ApiLayer): MapLayerRecord {
  return {
    id: row.key,
    label: row.label,
    color: row.color,
    defaultOn: row.defaultOn,
    count: row.count,
    order: row.order,
    recordId: row._id,
  };
}

function toPin(row: ApiPin): MapPinRecord {
  return {
    layerId: row.layerKey,
    name: row.name,
    industry: row.industry,
    address: row.address,
    workers: row.workers,
    representative: row.representative,
    phone: row.phone,
    x: row.x,
    y: row.y,
    lat: row.lat,
    lng: row.lng,
    recordId: row._id,
  };
}

/** Chỉ số chưa có nguồn dữ liệu giữ nguyên null để giao diện hiện dấu gạch */
function toSummary(row: ApiSummaryItem): EconomySummaryItem {
  return { value: row.value === null ? null : formatNumber(row.value), label: row.label, note: row.note };
}

/** Ánh xạ ngược `layerId` → `layerKey` cho thân yêu cầu gửi lên backend */
function toPinBody(input: MapPinInput): Record<string, unknown> {
  const { layerId, ...rest } = input;
  return layerId === undefined ? { ...rest } : { ...rest, layerKey: layerId };
}

/** Lớp mock cho chế độ demo — thứ tự lấy theo vị trí trong mảng mock */
function mockLayers(): MapLayerRecord[] {
  return mapLayers.map((layer, index) => ({ ...layer, order: index + 1, recordId: layer.id }));
}

// ─── Lớp dữ liệu ───────────────────────────────────────────────────────────

/** GET /map/layers — danh sách lớp kèm số ghim thuộc lớp */
export async function fetchMapLayers(): Promise<MapLayerRecord[]> {
  if (appConfig.api.useMocks) return mockDelay(mockLayers());
  const res = await apiClient.get<ListResponse<ApiLayer>>("/map/layers");
  return res.items.map(toLayer);
}

/** Ánh xạ ngược `id` → `key` cho thân yêu cầu gửi lên backend */
function toLayerBody(input: MapLayerInput, withKey: boolean): Record<string, unknown> {
  const { id, ...rest } = input;
  return withKey ? { ...rest, key: id } : { ...rest };
}

/** POST /map/layers */
export async function createMapLayer(input: MapLayerInput): Promise<MapLayerRecord> {
  if (appConfig.api.useMocks) {
    return mockDelay({
      id: input.id ?? "",
      label: input.label ?? "",
      color: input.color ?? "var(--blue)",
      defaultOn: input.defaultOn ?? true,
      count: 0,
      order: input.order ?? 0,
      recordId: input.id ?? "",
    });
  }
  return toLayer(await apiClient.post<ApiLayer>("/map/layers", toLayerBody(input, true)));
}

/** PATCH /map/layers/:recordId — không đổi được khoá lớp */
export async function updateMapLayer(recordId: string, input: MapLayerInput): Promise<MapLayerRecord> {
  if (appConfig.api.useMocks) {
    const found = mockLayers().find((l) => l.recordId === recordId);
    return mockDelay({ ...(found ?? mockLayers()[0]), ...input, recordId });
  }
  return toLayer(
    await apiClient.patch<ApiLayer>(`/map/layers/${encodeURIComponent(recordId)}`, toLayerBody(input, false)),
  );
}

// ─── Ghim ──────────────────────────────────────────────────────────────────

/** GET /map/pins?layerKey=&q= */
export async function fetchMapPins(query: { layerId?: string; q?: string } = {}): Promise<MapPinRecord[]> {
  if (appConfig.api.useMocks) {
    const keyword = (query.q ?? "").toLowerCase();
    const items = mapPins
      .filter((p) => !query.layerId || p.layerId === query.layerId)
      .filter((p) => !keyword || `${p.name} ${p.industry} ${p.address}`.toLowerCase().includes(keyword))
      .map<MapPinRecord>((p) => ({ ...p, recordId: `${p.layerId}-${p.name}` }));
    return mockDelay(items);
  }
  const res = await apiClient.get<ListResponse<ApiPin>>(
    `/map/pins${buildQuery({ layerKey: query.layerId, q: query.q })}`,
  );
  return res.items.map(toPin);
}

/** POST /map/pins */
export async function createMapPin(input: MapPinInput): Promise<MapPinRecord> {
  if (appConfig.api.useMocks) {
    return mockDelay({
      layerId: input.layerId ?? "",
      name: input.name ?? "",
      industry: input.industry ?? "",
      address: input.address ?? "",
      workers: input.workers ?? 0,
      representative: input.representative ?? "",
      phone: input.phone ?? "",
      x: input.x ?? 50,
      y: input.y ?? 50,
      lat: input.lat,
      lng: input.lng,
      recordId: `mock-${Date.now()}`,
    });
  }
  return toPin(await apiClient.post<ApiPin>("/map/pins", toPinBody(input)));
}

/** PATCH /map/pins/:recordId */
export async function updateMapPin(recordId: string, input: MapPinInput): Promise<MapPinRecord> {
  if (appConfig.api.useMocks) {
    const found = mapPins.find((p) => `${p.layerId}-${p.name}` === recordId) ?? mapPins[0];
    return mockDelay({ ...found, ...input, layerId: input.layerId ?? found.layerId, recordId });
  }
  return toPin(await apiClient.patch<ApiPin>(`/map/pins/${encodeURIComponent(recordId)}`, toPinBody(input)));
}

/** DELETE /map/pins/:recordId — cần quyền map:admin */
export async function deleteMapPin(recordId: string): Promise<{ id: string; deleted: boolean }> {
  if (appConfig.api.useMocks) return mockDelay({ id: recordId, deleted: true });
  return apiClient.delete<{ id: string; deleted: boolean }>(`/map/pins/${encodeURIComponent(recordId)}`);
}

// ─── Tổng hợp ──────────────────────────────────────────────────────────────

/** GET /map/overview — lớp + cơ cấu ngành + 4 chỉ số tổng hợp */
export async function fetchMapOverview(): Promise<MapOverview> {
  if (appConfig.api.useMocks) {
    return mockDelay({
      layers: mockLayers(),
      industryStructure: mockIndustry.map((c) => ({ ...c })),
      summary: economySummary.map((s) => ({ value: s.value, label: s.label })),
    });
  }
  const res = await apiClient.get<ApiOverview>("/map/overview");
  return {
    layers: res.layers.map(toLayer),
    industryStructure: res.industryStructure,
    summary: res.summary.map(toSummary),
  };
}

/** Thông báo lỗi thân thiện cho toast */
export function apiErrorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Không thực hiện được thao tác, vui lòng thử lại";
}
