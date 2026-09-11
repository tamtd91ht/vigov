import { appConfig } from "@/config/app.config";
import { exportDisbursementCsv } from "@/features/disbursement/exportCsv";
import { budgetItems } from "@/mocks/disbursement";
import type {
  BudgetItem,
  Comment,
  DisbursementEntry,
  DisbursementRequest,
  DisbursementRequestStatus,
  Obstacle,
} from "@/types";
import { ApiError, apiClient, buildQuery, downloadFile } from "./api";
import { authService } from "./auth";

/**
 * Phân hệ Ngân sách – Giải ngân (WBS #5).
 *
 * Backend định danh hạng mục bằng `code` (HM-xx) còn giao diện dùng `id`;
 * toàn bộ việc quy đổi nằm ở đây. Số liệu tổng hợp (`summary`) LẤY TỪ SERVER,
 * không cộng lại ở trình duyệt để hai nơi không lệch nhau.
 */

/**
 * Số liệu tổng hợp — MỌI TRƯỜNG TIỀN LÀ ĐỒNG, SỐ NGUYÊN, do máy chủ tính.
 * Giao diện không tự cộng lại: xem `lib/money.ts`.
 */
export interface DisbursementSummary {
  totalItems: number;
  totalPlannedDong: number;
  totalActualDong: number;
  totalRemainingDong: number;
  /** `null` = chưa có kế hoạch vốn nào, KHÁC "giải ngân 0%" */
  percent: number | null;
  /** Đếm hạng mục theo tình trạng tiến độ */
  schedule: {
    onTrack: number;
    atRisk: number;
    late: number;
    done: number;
    notStarted: number;
  };
  /** Đã cam kết qua đề nghị nhưng chưa chi — đồng */
  committedDong: number;
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
  owner?: string;
  expenseType?: string;
  fundingSource?: string;
  program?: string;
  /** Chọn nhiều trạng thái hồ sơ */
  approvalStatus?: string[];
  /** Chọn nhiều tình trạng tiến độ (chậm, nguy cơ chậm…) */
  scheduleState?: string[];
  /** Chọn nhiều mức giải ngân */
  disbursementState?: string[];
  /** Khoảng tỷ lệ giải ngân, % */
  minPercent?: number;
  maxPercent?: number;
  /** Chỉ hạng mục sắp hết hạn */
  dueSoon?: boolean;
  q?: string;
  /** true: xem các hạng mục ĐÃ xoá mềm (bộ lọc "Đã xoá") */
  deleted?: boolean;
}

/** Một dòng trong màn hình quản lý đề nghị giải ngân — kèm thông tin hạng mục */
export interface DisbursementRequestRow extends DisbursementRequest {
  budgetCode: string;
  budgetName: string;
  fundingSource: string;
  owner: string;
}

/** Số liệu tổng hợp của màn hình quản lý đề nghị */
export interface RequestSummary {
  pending: number;
  approved: number;
  rejected: number;
  disbursed: number;
  /** Tổng tiền đang chờ duyệt — ĐỒNG. Phần ngân sách đã cam kết nhưng chưa quyết */
  pendingAmountDong: number;
}

/** Kết quả danh sách đề nghị giải ngân toàn xã */
export interface RequestListResult {
  year: number;
  items: DisbursementRequestRow[];
  summary: RequestSummary;
}

/** Hạng mục ngân sách do backend trả về */
interface BudgetApiItem {
  code: string;
  name?: string;
  fundingSource?: string;
  fundingColor?: string;
  owner?: string;
  year?: number;
  /** Tiền — ĐỒNG, số nguyên */
  initialPlannedDong?: number;
  plannedDong?: number;
  actualDong?: number;
  /* Phần máy chủ tính sẵn (remainingDong, percent, scheduleState, các nhãn…)
     không liệt kê ở đây: `toBudgetItem` chép nguyên bản ghi sang `BudgetItem`,
     nên khai thêm ở đây chỉ là nhân bản danh sách trường. */
  entries?: DisbursementEntry[];
  comments?: Comment[];
  obstacles?: Obstacle[];
  requests?: DisbursementRequest[];
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
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
  /** Dự toán giao đầu năm — ĐỒNG, số nguyên */
  initialPlannedDong: number;
  fundingColor?: string;
  purpose?: string;
  expenseType?: string;
  budgetLevel?: string;
  program?: string;
  beneficiary?: string;
  beneficiaryType?: string;
  beneficiaryTaxCode?: string;
  carryOverFromYear?: number;
  /** dd/MM/yyyy */
  startDate?: string;
  endDate?: string;
  quarterPlans?: { quarter: number; amountDong: number }[];
}

/** Sửa hạng mục — không đổi được dự toán, phải qua điều chỉnh dự toán */
export type UpdateBudgetInput = Partial<Omit<CreateBudgetInput, "initialPlannedDong" | "year">> & {
  note?: string;
};

/** Đổi trạng thái hồ sơ theo workflow */
export interface ChangeStatusInput {
  status: string;
  /** Bắt buộc khi từ chối / tạm dừng / huỷ */
  note?: string;
  lateReason?: string;
}

/** Một lần điều chỉnh dự toán — căn cứ bắt buộc là số quyết định */
export interface CreateAdjustmentInput {
  decisionNo: string;
  /** dd/MM/yyyy */
  decidedAt: string;
  /** ĐỒNG, số nguyên. ÂM là giảm dự toán */
  deltaDong: number;
  reason: string;
  fileIds?: string[];
}

/** Gắn một hồ sơ vào hạng mục */
export interface AddDocumentInput {
  fileId: string;
  refNo?: string;
  docType?: string;
  issuedDate?: string;
  issuer?: string;
  summary?: string;
}

/** Dữ liệu ghi nhận một lần giải ngân */
export interface CreateEntryInput {
  date: string;
  content: string;
  /** Số tiền — ĐỒNG, số nguyên. Bỏ hẳn cách nhập chuỗi "1,25 tỷ" */
  amountDong: number;
  /** Bỏ trống = chi trả. `hoan-tra` trừ khỏi luỹ kế */
  type?: "chi" | "hoan-tra";
  vendor?: string;
  vendorTaxCode?: string;
  voucherNo?: string;
  fileIds?: string[];
}

/** Kết quả sau khi ghi nhận giải ngân — luỹ kế do server tính lại */
export type EntryResult = BudgetItem & { entry: DisbursementEntry };

/** Dữ liệu thêm vướng mắc cần tháo gỡ */
export interface CreateObstacleInput {
  content: string;
  owner?: string;
  deadline?: string;
}

/** Dữ liệu đề nghị giải ngân đợt tiếp theo */
export interface CreateRequestInput {
  /** Số tiền đề nghị — ĐỒNG, số nguyên */
  amountDong: number;
  content: string;
  vendor?: string;
  vendorTaxCode?: string;
  fileIds?: string[];
}

/** Phản hồi của POST /disbursement/:code/requests */
export interface RequestResult {
  code: string;
  message: string;
  /** Đề nghị vừa tạo, kèm mã DN-xx do server cấp */
  request: DisbursementRequest;
  /** Phần vốn còn đề nghị được sau lần này — đồng */
  remainingDong: number;
}

/** Kết quả sau khi ghi nhận đề nghị đã chi — luỹ kế do server tính lại */
export type DisburseResult = BudgetItem & {
  request: DisbursementRequest;
  entry: DisbursementEntry;
};

/** Đường dẫn tải báo cáo Excel của kỳ báo cáo năm */
const EXCEL_EXPORT_PATH = "/reports/export/excel";

/**
 * Ánh xạ hạng mục backend sang kiểu dùng cho giao diện.
 *
 * Giữ NGUYÊN mọi trường máy chủ trả về (kể cả phần tính toán: `percent`,
 * `remainingDong`, `scheduleState`, các nhãn) rồi chỉ đổi `code` → `id`. Liệt kê
 * từng trường như bản trước là mỗi lần backend thêm một trường tính toán lại
 * phải sửa ở đây, và quên một trường thì giao diện im lặng hiện thiếu.
 */
function toBudgetItem(raw: BudgetApiItem): BudgetItem {
  return {
    ...(raw as unknown as BudgetItem),
    id: raw.code,
    fundingColor: raw.fundingColor || "var(--blue)",
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
  const sum = (pick: (it: BudgetItem) => number) =>
    items.reduce((total, it) => total + Math.trunc(pick(it) || 0), 0);
  const totalPlanned = sum((it) => it.plannedDong);
  const totalActual = sum((it) => it.actualDong);
  const countBy = (state: string) => items.filter((it) => it.scheduleState === state).length;

  return {
    totalItems: items.length,
    totalPlannedDong: totalPlanned,
    totalActualDong: totalActual,
    totalRemainingDong: totalPlanned - totalActual,
    percent: totalPlanned > 0 ? Math.round((totalActual * 10_000) / totalPlanned) / 100 : null,
    schedule: {
      onTrack: countBy("dung-tien-do"),
      atRisk: countBy("nguy-co-cham"),
      late: countBy("cham"),
      done: countBy("hoan-thanh"),
      notStarted: countBy("chua-den-han"),
    },
    committedDong: items.reduce(
      (total, it) =>
        total +
        (it.requests ?? [])
          .filter((r) => r.status === "pending" || r.status === "approved")
          .reduce((s, r) => s + Math.trunc(r.amountDong || 0), 0),
      0,
    ),
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

/** Nhãn thời gian "14:05 27/08/2026" dùng ở nhánh mock */
function mockStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Ngày "27/08/2026" dùng ở nhánh mock */
function mockToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Tìm đề nghị trong dữ liệu mock, báo lỗi giống backend khi không có */
function mockRequest(code: string, requestCode: string): DisbursementRequest {
  const found = mockDetail(code).requests.find((r) => r.code === requestCode);
  if (!found) throw new Error(`Không tìm thấy đề nghị ${requestCode} trong hạng mục ${code}`);
  return found;
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
      /* Dữ liệu mẫu không có hạng mục đã xoá nên bộ lọc "Đã xoá" trả danh sách rỗng */
      const live = filter.deleted ? [] : budgetItems;
      const byState = filter.scheduleState?.length
        ? live.filter((it) => filter.scheduleState?.includes(it.scheduleState ?? ""))
        : live;
      const scoped = filter.owner ? byState.filter((it) => it.owner === filter.owner) : byState;
      return mockDelay({
        year: filter.year ?? new Date().getFullYear(),
        items: scoped,
        summary: mockSummary(scoped),
      });
    }

    const qs = buildQuery({
      year: filter.year,
      owner: filter.owner,
      expenseType: filter.expenseType,
      fundingSource: filter.fundingSource,
      program: filter.program,
      approvalStatus: filter.approvalStatus,
      scheduleState: filter.scheduleState,
      disbursementState: filter.disbursementState,
      minPercent: filter.minPercent,
      maxPercent: filter.maxPercent,
      dueSoon: filter.dueSoon ? "true" : undefined,
      q: filter.q,
      deleted: filter.deleted,
    });
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
        year: input.year,
        initialPlannedDong: input.initialPlannedDong,
        plannedDong: input.initialPlannedDong,
        actualDong: 0,
        /* Hạng mục mới luôn ở Nháp — phải trình duyệt mới phát sinh tiền được */
        approvalStatus: "nhap",
        remainingDong: input.initialPlannedDong,
        percent: input.initialPlannedDong > 0 ? 0 : null,
        disbursementState: "chua-chi",
        scheduleState: "chua-den-han",
        entries: [],
        adjustments: [],
        documents: [],
        progressLogs: [],
        comments: [],
        obstacles: [],
        requests: [],
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
        type: input.type ?? "chi",
        amountDong: input.amountDong,
        content: input.content,
        voucherNo: input.voucherNo ?? "",
        vendor: input.vendor ?? "",
        by: "Cán bộ xã",
      };
      const delta = entry.type === "hoan-tra" ? -entry.amountDong : entry.amountDong;
      const actualDong = item.actualDong + delta;
      return mockDelay<EntryResult>({
        ...item,
        actualDong,
        remainingDong: item.plannedDong - actualDong,
        percent:
          item.plannedDong > 0 ? Math.round((actualDong * 10_000) / item.plannedDong) / 100 : null,
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

  /** Gửi đề nghị giải ngân đợt tiếp theo — vào trạng thái chờ duyệt */
  async createRequest(code: string, input: CreateRequestInput): Promise<RequestResult> {
    if (appConfig.api.useMocks) {
      const item = mockDetail(code);
      const request: DisbursementRequest = {
        code: `DN-${String(item.requests.length + 1).padStart(2, "0")}`,
        amountDong: input.amountDong,
        content: input.content,
        vendor: input.vendor ?? "",
        status: "pending",
        requestedBy: "Cán bộ xã",
        requestedAt: mockStamp(),
        decidedBy: "",
        decidedAt: "",
        rejectReason: "",
        voucherNo: "",
        disbursedAt: "",
      };
      return mockDelay<RequestResult>({
        code,
        message: "Đề nghị giải ngân chờ duyệt",
        request,
        remainingDong: Math.max(0, item.plannedDong - item.actualDong - input.amountDong),
      });
    }
    return apiClient.post<RequestResult>(`/disbursement/${encodeURIComponent(code)}/requests`, input);
  },

  /** Danh sách đề nghị giải ngân toàn xã — màn hình quản lý đề nghị */
  async listRequests(
    filter: { year?: number; status?: DisbursementRequestStatus } = {},
  ): Promise<RequestListResult> {
    if (appConfig.api.useMocks) {
      const rows: DisbursementRequestRow[] = budgetItems.flatMap((item) =>
        item.requests
          .filter((r) => !filter.status || r.status === filter.status)
          .map((r) => ({
            ...r,
            budgetCode: item.id,
            budgetName: item.name,
            fundingSource: item.fundingSource,
            owner: item.owner,
          })),
      );
      const all = budgetItems.flatMap((it) => it.requests);
      return mockDelay({
        year: filter.year ?? new Date().getFullYear(),
        items: rows,
        summary: {
          pending: all.filter((r) => r.status === "pending").length,
          approved: all.filter((r) => r.status === "approved").length,
          rejected: all.filter((r) => r.status === "rejected").length,
          disbursed: all.filter((r) => r.status === "disbursed").length,
          pendingAmountDong: all
            .filter((r) => r.status === "pending")
            .reduce((s, r) => s + Math.trunc(r.amountDong || 0), 0),
        },
      });
    }
    const qs = buildQuery({ year: filter.year, status: filter.status });
    return apiClient.get<RequestListResult>(`/disbursement/requests${qs}`);
  },

  /** Duyệt đề nghị (quyền approve) — chưa cộng tiền vào luỹ kế */
  async approveRequest(code: string, requestCode: string): Promise<DisbursementRequest> {
    if (appConfig.api.useMocks) {
      return mockDelay<DisbursementRequest>({
        ...mockRequest(code, requestCode),
        status: "approved",
        decidedBy: "Cán bộ xã",
        decidedAt: mockStamp(),
      });
    }
    const res = await apiClient.patch<{ code: string; request: DisbursementRequest }>(
      `/disbursement/${encodeURIComponent(code)}/requests/${encodeURIComponent(requestCode)}/approve`,
      undefined,
    );
    return res.request;
  },

  /** Từ chối đề nghị kèm lý do (quyền approve) */
  async rejectRequest(
    code: string,
    requestCode: string,
    reason: string,
  ): Promise<DisbursementRequest> {
    if (appConfig.api.useMocks) {
      return mockDelay<DisbursementRequest>({
        ...mockRequest(code, requestCode),
        status: "rejected",
        rejectReason: reason,
        decidedBy: "Cán bộ xã",
        decidedAt: mockStamp(),
      });
    }
    const res = await apiClient.patch<{ code: string; request: DisbursementRequest }>(
      `/disbursement/${encodeURIComponent(code)}/requests/${encodeURIComponent(requestCode)}/reject`,
      { reason },
    );
    return res.request;
  },

  /**
   * Ghi nhận đề nghị đã chi thật — bước cộng tiền vào luỹ kế và sinh một dòng
   * trong Lịch sử giải ngân. Số chứng từ bắt buộc để đối chiếu sổ kế toán.
   */
  async disburseRequest(
    code: string,
    requestCode: string,
    input: { voucherNo: string; date?: string },
  ): Promise<DisburseResult> {
    if (appConfig.api.useMocks) {
      const item = mockDetail(code);
      const request = mockRequest(code, requestCode);
      const date = input.date?.trim() || mockToday();
      const actualDong = item.actualDong + request.amountDong;
      return mockDelay<DisburseResult>({
        ...item,
        actualDong,
        remainingDong: item.plannedDong - actualDong,
        percent:
          item.plannedDong > 0 ? Math.round((actualDong * 10_000) / item.plannedDong) / 100 : null,
        request: { ...request, status: "disbursed", voucherNo: input.voucherNo, disbursedAt: date },
        entry: {
          date,
          type: "chi",
          amountDong: request.amountDong,
          content: request.content,
          voucherNo: input.voucherNo,
          vendor: request.vendor,
          by: "Cán bộ xã",
          requestCode: request.code,
        },
      });
    }
    return apiClient.patch<DisburseResult>(
      `/disbursement/${encodeURIComponent(code)}/requests/${encodeURIComponent(requestCode)}/disburse`,
      input,
    );
  },

  /**
   * Sửa thông tin hạng mục (quyền edit).
   * KHÔNG đổi được dự toán qua đường này — phải dùng `addAdjustment`.
   */
  async update(code: string, input: UpdateBudgetInput): Promise<BudgetItem> {
    if (appConfig.api.useMocks) return mockDelay({ ...mockDetail(code), ...input } as BudgetItem);
    return toBudgetItem(
      await apiClient.patch<BudgetApiItem>(`/disbursement/${encodeURIComponent(code)}`, input),
    );
  },

  /**
   * Đổi trạng thái hồ sơ theo workflow.
   *
   * Mức quyền của từng bước do MÁY CHỦ kiểm (gửi duyệt cần `edit`, duyệt cần
   * `approve`, huỷ cần `admin`). Giao diện chỉ ẩn nút cho gọn — ẩn nút là trải
   * nghiệm, chặn ở API mới là bảo mật.
   */
  async changeStatus(code: string, input: ChangeStatusInput): Promise<BudgetItem> {
    if (appConfig.api.useMocks) {
      return mockDelay({
        ...mockDetail(code),
        approvalStatus: input.status,
        statusNote: input.note ?? "",
      } as BudgetItem);
    }
    return toBudgetItem(
      await apiClient.patch<BudgetApiItem>(
        `/disbursement/${encodeURIComponent(code)}/status`,
        input,
      ),
    );
  },

  /** Điều chỉnh dự toán (quyền approve) — đường DUY NHẤT đổi kế hoạch vốn */
  async addAdjustment(code: string, input: CreateAdjustmentInput): Promise<BudgetItem> {
    if (appConfig.api.useMocks) {
      const item = mockDetail(code);
      const plannedDong = item.plannedDong + input.deltaDong;
      return mockDelay({ ...item, plannedDong, remainingDong: plannedDong - item.actualDong });
    }
    return toBudgetItem(
      await apiClient.post<BudgetApiItem>(
        `/disbursement/${encodeURIComponent(code)}/adjustments`,
        input,
      ),
    );
  },

  /** Gắn một văn bản / hồ sơ vào hạng mục (quyền edit) */
  async addDocument(code: string, input: AddDocumentInput): Promise<BudgetItem> {
    if (appConfig.api.useMocks) return mockDelay(mockDetail(code));
    return toBudgetItem(
      await apiClient.post<BudgetApiItem>(
        `/disbursement/${encodeURIComponent(code)}/documents`,
        input,
      ),
    );
  },

  /** Gỡ liên kết một hồ sơ — tệp vẫn còn trong kho tệp */
  async removeDocument(code: string, fileId: string): Promise<BudgetItem> {
    if (appConfig.api.useMocks) return mockDelay(mockDetail(code));
    return toBudgetItem(
      await apiClient.delete<BudgetApiItem>(
        `/disbursement/${encodeURIComponent(code)}/documents/${encodeURIComponent(fileId)}`,
      ),
    );
  },

  /**
   * Xuất Excel danh sách hạng mục theo ĐÚNG bộ lọc đang áp dụng.
   * Khác `exportYearReport` (báo cáo tổng hợp cả xã): đây là bảng danh sách.
   */
  async exportListExcel(filter: DisbursementListFilter = {}): Promise<string> {
    const qs = buildQuery({
      year: filter.year,
      owner: filter.owner,
      expenseType: filter.expenseType,
      fundingSource: filter.fundingSource,
      program: filter.program,
      approvalStatus: filter.approvalStatus,
      scheduleState: filter.scheduleState,
      disbursementState: filter.disbursementState,
      minPercent: filter.minPercent,
      maxPercent: filter.maxPercent,
      dueSoon: filter.dueSoon ? "true" : undefined,
      q: filter.q,
      deleted: filter.deleted,
    });
    return downloadFile(`/disbursement/export/excel${qs}`, "danh-sach-giai-ngan.xlsx");
  },

  /** Xoá mềm hạng mục (quyền admin) — dữ liệu vẫn giữ, khôi phục được */
  async softDelete(code: string, reason?: string): Promise<BudgetItem> {
    if (appConfig.api.useMocks) return mockDelay(mockDetail(code));
    return toBudgetItem(
      await apiClient.patch<BudgetApiItem>(
        `/disbursement/${encodeURIComponent(code)}/delete`,
        reason ? { reason } : {},
      ),
    );
  },

  /** Khôi phục hạng mục đã xoá mềm (quyền admin) */
  async restore(code: string): Promise<BudgetItem> {
    if (appConfig.api.useMocks) return mockDelay(mockDetail(code));
    return toBudgetItem(
      await apiClient.patch<BudgetApiItem>(`/disbursement/${encodeURIComponent(code)}/restore`, undefined),
    );
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
