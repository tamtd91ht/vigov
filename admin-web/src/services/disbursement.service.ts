import { appConfig } from "@/config/app.config";
import { exportDisbursementCsv } from "@/features/disbursement/exportCsv";
import { budgetItems } from "@/mocks/disbursement";
import type { BudgetItem, Comment, DisbursementEntry, Obstacle } from "@/types";
import { ApiError, apiClient, buildQuery } from "./api";
import { authService } from "./auth";

/**
 * Phân hệ Ngân sách – Giải ngân (WBS #5).
 *
 * Backend định danh hạng mục bằng `code` (HM-xx) còn giao diện dùng `id`;
 * toàn bộ việc quy đổi nằm ở đây. Số liệu tổng hợp (`summary`) LẤY TỪ SERVER,
 * không cộng lại ở trình duyệt để hai nơi không lệch nhau.
 */

/** Số liệu tổng hợp giải ngân toàn xã do server tính */
export interface DisbursementSummary {
  /** Tổng kế hoạch vốn (tỷ đồng) */
  totalPlanned: number;
  /** Tổng đã giải ngân (tỷ đồng) */
  totalActual: number;
  /** Tỷ lệ giải ngân (%) */
  percent: number;
  /** Số hạng mục chậm tiến độ */
  delayedCount: number;
}

/** Kết quả danh sách hạng mục theo năm ngân sách */
export interface DisbursementListResult {
  year: number;
  items: BudgetItem[];
  summary: DisbursementSummary;
}

/** Bộ lọc danh sách hạng mục gửi lên server */
export interface DisbursementListFilter {
  year?: number;
  /** true: chỉ lấy hạng mục chậm tiến độ */
  delayed?: boolean;
  owner?: string;
}

/** Hạng mục ngân sách do backend trả về */
interface BudgetApiItem {
  code: string;
  name?: string;
  fundingSource?: string;
  fundingColor?: string;
  owner?: string;
  year?: number;
  planned?: number;
  actual?: number;
  delayed?: boolean;
  entries?: DisbursementEntry[];
  comments?: Comment[];
  obstacles?: Obstacle[];
}

/** Phản hồi của GET /disbursement */
interface DisbursementApiList {
  year: number;
  items: BudgetApiItem[];
  summary: DisbursementSummary;
}

/** Dữ liệu tạo hạng mục ngân sách mới */
export interface CreateBudgetInput {
  name: string;
  fundingSource: string;
  owner: string;
  year: number;
  /** Kế hoạch vốn, đơn vị tỷ đồng */
  planned: number;
  fundingColor?: string;
}

/** Dữ liệu ghi nhận một lần giải ngân */
export interface CreateEntryInput {
  date: string;
  content: string;
  /** Số tiền dạng chuỗi, ví dụ "1,25 tỷ" — server tự quy đổi */
  amount: string;
  vendor?: string;
  voucherNo?: string;
}

/** Kết quả sau khi ghi nhận giải ngân — luỹ kế do server tính lại */
export interface EntryResult {
  code: string;
  planned: number;
  actual: number;
  percent: number;
  delayed: boolean;
  entry: DisbursementEntry;
}

/** Dữ liệu thêm vướng mắc cần tháo gỡ */
export interface CreateObstacleInput {
  content: string;
  owner?: string;
  deadline?: string;
}

/** Dữ liệu đề nghị giải ngân đợt tiếp theo */
export interface CreateRequestInput {
  /** Số tiền dạng chuỗi, ví dụ "0,8 tỷ" */
  amount: string;
  content: string;
  vendor?: string;
}

/** Phản hồi của POST /disbursement/:code/requests */
export interface RequestResult {
  code: string;
  status: string;
  message: string;
  amount: string;
  amountTyDong: number;
  requestedBy: string;
  comment: Comment;
}

/** Đường dẫn tải báo cáo Excel của kỳ báo cáo năm */
const EXCEL_EXPORT_PATH = "/reports/export/excel";

/** Ánh xạ hạng mục backend sang kiểu dùng cho giao diện (code → id) */
function toBudgetItem(raw: BudgetApiItem): BudgetItem {
  return {
    id: raw.code,
    name: raw.name ?? "",
    fundingSource: raw.fundingSource ?? "",
    fundingColor: raw.fundingColor || "var(--blue)",
    owner: raw.owner ?? "",
    planned: raw.planned ?? 0,
    actual: raw.actual ?? 0,
    delayed: raw.delayed ?? false,
    entries: raw.entries ?? [],
    comments: raw.comments ?? [],
    obstacles: raw.obstacles ?? [],
  };
}

/** Độ trễ giả lập cho nhánh mock để giao diện vẫn thể hiện trạng thái tải */
function mockDelay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), appConfig.api.mockDelayMs));
}

/** Tìm hạng mục trong dữ liệu mock, báo lỗi giống backend khi không có */
function mockDetail(code: string): BudgetItem {
  const found = budgetItems.find((item) => item.id === code);
  if (!found) throw new Error(`Không tìm thấy hạng mục ${code}`);
  return found;
}

/** Tổng hợp trên dữ liệu mock — chỉ dùng khi useMocks, bản thật lấy từ server */
function mockSummary(items: BudgetItem[]): DisbursementSummary {
  const round = (n: number) => Math.round(n * 100) / 100;
  const totalPlanned = items.reduce((sum, it) => sum + it.planned, 0);
  const totalActual = items.reduce((sum, it) => sum + it.actual, 0);
  return {
    totalPlanned: round(totalPlanned),
    totalActual: round(totalActual),
    percent: totalPlanned > 0 ? round((totalActual / totalPlanned) * 100) : 0,
    delayedCount: items.filter((it) => it.delayed).length,
  };
}

/** Bình luận dựng ở nhánh mock (bản thật do server ghi kèm tác giả từ token) */
function mockComment(content: string): Comment {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    authorName: "Cán bộ xã",
    authorInitials: "CX",
    authorColor: "var(--blue)",
    time: `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`,
    content,
  };
}

/** Tên tệp trong header Content-Disposition; rỗng thì dùng tên mặc định */
function fileNameFrom(disposition: string | null, fallback: string): string {
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? fallback;
}

/** Lưu Blob về máy người dùng bằng thẻ <a download> tạm */
function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const disbursementService = {
  /** Danh sách hạng mục theo năm + số liệu tổng hợp do server tính */
  async list(filter: DisbursementListFilter = {}): Promise<DisbursementListResult> {
    if (appConfig.api.useMocks) {
      const items = filter.delayed ? budgetItems.filter((it) => it.delayed) : budgetItems;
      const scoped = filter.owner ? items.filter((it) => it.owner === filter.owner) : items;
      return mockDelay({
        year: filter.year ?? new Date().getFullYear(),
        items: scoped,
        summary: mockSummary(scoped),
      });
    }

    const qs = buildQuery({ year: filter.year, delayed: filter.delayed, owner: filter.owner });
    const res = await apiClient.get<DisbursementApiList>(`/disbursement${qs}`);
    return {
      year: res.year,
      items: (res.items ?? []).map(toBudgetItem),
      summary: res.summary,
    };
  },

  /** Chi tiết một hạng mục theo mã HM-xx */
  async detail(code: string): Promise<BudgetItem> {
    if (appConfig.api.useMocks) return mockDelay(mockDetail(code));
    return toBudgetItem(await apiClient.get<BudgetApiItem>(`/disbursement/${encodeURIComponent(code)}`));
  },

  /** Tạo hạng mục ngân sách mới; mã HM-xx do server sinh */
  async create(input: CreateBudgetInput): Promise<BudgetItem> {
    if (appConfig.api.useMocks) {
      return mockDelay<BudgetItem>({
        id: `HM-${String(budgetItems.length + 1).padStart(2, "0")}`,
        name: input.name,
        fundingSource: input.fundingSource,
        fundingColor: input.fundingColor ?? "var(--blue)",
        owner: input.owner,
        planned: input.planned,
        actual: 0,
        delayed: input.planned > 0,
        entries: [],
        comments: [],
        obstacles: [],
      });
    }
    return toBudgetItem(await apiClient.post<BudgetApiItem>("/disbursement", input));
  },

  /** Ghi nhận một lần giải ngân; server cộng luỹ kế và tính lại cờ chậm tiến độ */
  async addEntry(code: string, input: CreateEntryInput): Promise<EntryResult> {
    if (appConfig.api.useMocks) {
      const item = mockDetail(code);
      const entry: DisbursementEntry = {
        date: input.date,
        content: input.content,
        amount: input.amount,
        vendor: input.vendor ?? "",
        by: "Cán bộ xã",
        voucherNo: input.voucherNo ?? "",
      };
      return mockDelay({
        code,
        planned: item.planned,
        actual: item.actual,
        percent: item.planned > 0 ? Math.round((item.actual / item.planned) * 100) : 0,
        delayed: item.delayed,
        entry,
      });
    }
    return apiClient.post<EntryResult>(`/disbursement/${encodeURIComponent(code)}/entries`, input);
  },

  /** Thêm bình luận trao đổi; tác giả do server lấy từ token */
  async addComment(code: string, content: string): Promise<Comment> {
    if (appConfig.api.useMocks) return mockDelay(mockComment(content));
    const res = await apiClient.post<{ code: string; comment: Comment }>(
      `/disbursement/${encodeURIComponent(code)}/comments`,
      { content },
    );
    return res.comment;
  },

  /** Thêm vướng mắc cần tháo gỡ; trả về danh sách vướng mắc sau khi thêm */
  async addObstacle(code: string, input: CreateObstacleInput): Promise<Obstacle[]> {
    if (appConfig.api.useMocks) {
      return mockDelay([
        ...mockDetail(code).obstacles,
        { content: input.content, owner: input.owner ?? "", deadline: input.deadline ?? "" },
      ]);
    }
    const res = await apiClient.post<{ code: string; obstacles: Obstacle[] }>(
      `/disbursement/${encodeURIComponent(code)}/obstacles`,
      input,
    );
    return res.obstacles;
  },

  /**
   * Đánh dấu một vướng mắc đã tháo gỡ theo vị trí trong danh sách.
   * Server xoá vướng mắc khỏi hạng mục và ghi một bình luận hệ thống.
   */
  async resolveObstacle(code: string, index: number): Promise<{ resolved: Obstacle; obstacles: Obstacle[] }> {
    if (appConfig.api.useMocks) {
      const obstacles = [...mockDetail(code).obstacles];
      const [resolved] = obstacles.splice(index, 1);
      return mockDelay({ resolved, obstacles });
    }
    const res = await apiClient.patch<{ code: string; resolved: Obstacle; obstacles: Obstacle[] }>(
      `/disbursement/${encodeURIComponent(code)}/obstacles/${index}/resolve`,
      undefined,
    );
    return { resolved: res.resolved, obstacles: res.obstacles };
  },

  /** Gửi đề nghị giải ngân đợt tiếp theo (Phase 1 ghi nhận ở trạng thái chờ duyệt) */
  async createRequest(code: string, input: CreateRequestInput): Promise<RequestResult> {
    if (appConfig.api.useMocks) {
      return mockDelay<RequestResult>({
        code,
        status: "pending",
        message: "Đề nghị giải ngân chờ duyệt",
        amount: input.amount,
        amountTyDong: Number(input.amount.replace(",", ".")) || 0,
        requestedBy: "Cán bộ xã",
        comment: mockComment(`Đề nghị giải ngân chờ duyệt: ${input.amount} cho "${input.content}"`),
      });
    }
    return apiClient.post<RequestResult>(`/disbursement/${encodeURIComponent(code)}/requests`, input);
  },

  /**
   * Tải báo cáo giải ngân của năm.
   *
   * Bản thật gọi `GET /reports/export/excel?period=year&year=…` — endpoint trả tệp
   * nhị phân .xlsx nên phải dùng `fetch` trực tiếp (apiClient chỉ đọc JSON), kèm
   * header Authorization rồi lưu về máy bằng Blob.
   * Chế độ mock quay về kết xuất CSV tại trình duyệt (`exportCsv.ts`).
   *
   * @returns "excel" hoặc "csv" để giao diện báo đúng định dạng đã tải
   */
  async exportYearReport(year: number, mockItems: BudgetItem[]): Promise<"excel" | "csv"> {
    if (appConfig.api.useMocks) {
      exportDisbursementCsv(mockItems, year);
      return "csv";
    }

    const url = `${appConfig.api.baseUrl}${EXCEL_EXPORT_PATH}${buildQuery({ period: "year", year })}`;
    let res: Response;
    try {
      const token = authService.getAccessToken();
      res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch {
      throw new ApiError("Không kết nối được máy chủ. Kiểm tra đường truyền rồi thử lại.", 0);
    }
    if (!res.ok) {
      throw new ApiError(`Không tải được báo cáo Excel (mã lỗi ${res.status})`, res.status);
    }

    const blob = await res.blob();
    saveBlob(blob, fileNameFrom(res.headers.get("Content-Disposition"), `bao-cao-giai-ngan-${year}.xlsx`));
    return "excel";
  },
};
