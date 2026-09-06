import { ApiError, apiClient, mockDelay } from "@/services/api";
import { appConfig } from "@/config/app.config";
import { lookupMockDossier } from "@/mocks/dossier.mock";
import type { DossierResult } from "@/types";

/**
 * Tra cứu hồ sơ một cửa (WBS #15) — GET /dossiers/lookup/:code.
 *
 * Endpoint của backend là CÔNG KHAI (công dân tra bằng mã trên giấy tiếp nhận,
 * không cần định danh), nên hàm dưới đây gọi được cả khi chưa liên kết SĐT.
 *
 * Cờ appConfig.api.useMocks rẽ nhánh NGAY TẠI ĐÂY, đúng khuôn của
 * content.service.ts / feedback.service.ts — màn hình chỉ gọi service và không
 * biết dữ liệu đến từ đâu. Trước đây LookupPage import thẳng `@/mocks`, nên bật
 * tắt cờ không có tác dụng gì và bản chạy thật vẫn đọc dữ liệu mẫu.
 */

/** Tổng số bước của quy trình một cửa — khớp DOSSIER_STEP_KEYS của backend */
const TOTAL_STEPS = 4;

/** Backend trả 404 khi không có hồ sơ nào khớp mã */
const HTTP_NOT_FOUND = 404;

/** Một bước trong tracker như backend trả về */
interface ApiDossierStep {
  key: string;
  label: string;
  /** ISO 8601; null nghĩa là hồ sơ chưa đi tới bước này */
  at: string | null;
  done: boolean;
}

/** Phản hồi của GET /dossiers/lookup/:code */
interface ApiDossier {
  code: string;
  procedure: string;
  applicantName: string;
  /** Đã che sẵn phía backend ("091•••311") — không bao giờ là số thật */
  applicantPhone: string;
  department: string;
  assignee: string;
  status: string;
  submittedAt: string | null;
  dueAt: string | null;
  note: string;
  steps: ApiDossierStep[];
}

/**
 * Nhãn trạng thái hiển thị trên card kết quả.
 * Giữ nguyên câu chữ của bản demo trước khi nối API để người dùng thử không
 * thấy giao diện đổi nội dung.
 */
const STATUS_LABELS: Record<string, string> = {
  received: "Đã tiếp nhận",
  appraising: "Đang xử lý",
  awaiting_signature: "Chờ ký duyệt",
  returned: "Đã có kết quả — mời nhận tại bộ phận một cửa",
};

/**
 * Bước hiện tại theo cách đếm 1-based của StepTracker.
 *
 * Backend trả cờ `done` cho từng bước chứ không trả chỉ số — suy ở đây để hợp
 * đồng API không phải mang thêm một trường có thể tự mâu thuẫn với `done`.
 * Bước hiện tại = bước ĐẦU TIÊN chưa xong; xong hết thì là bước cuối.
 */
function currentStepOf(steps: ApiDossierStep[]): number {
  const pending = steps.findIndex((step) => !step.done);
  return pending < 0 ? steps.length || TOTAL_STEPS : pending + 1;
}

/** ISO 8601 → "dd/MM/yyyy HH:mm"; thiếu mốc thì trả chuỗi rỗng */
function dateTimeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** ISO 8601 → "dd/MM/yyyy" — hạn trả kết quả trên giấy hẹn chỉ tính theo ngày */
function dateLabel(iso: string | null): string {
  return dateTimeLabel(iso).slice(0, 10);
}

function toDossier(raw: ApiDossier): DossierResult {
  return {
    code: raw.code,
    procedure: raw.procedure,
    applicant: raw.applicantName,
    statusLabel: STATUS_LABELS[raw.status] ?? "Đang xử lý",
    // Gộp "Tên — Bộ phận" cho một dòng thông tin trên card
    officer: [raw.assignee, raw.department].filter(Boolean).join(" — "),
    currentStep: currentStepOf(raw.steps),
    steps: raw.steps.map((step) => step.label),
    submittedAt: dateTimeLabel(raw.submittedAt),
    expectedAt: dateLabel(raw.dueAt),
  };
}

export const dossierService = {
  /**
   * Tra cứu hồ sơ theo mã. Trả `undefined` khi không có hồ sơ nào khớp —
   * màn hình phân biệt "không tìm thấy" với lỗi mạng bằng chính giá trị này,
   * còn lỗi thật (mất kết nối, hạn mức) vẫn được ném ra dưới dạng ApiError.
   *
   * Backend đã chuẩn hoá hoa/thường và cắt khoảng trắng, nhưng vẫn trim ở đây
   * để không gửi lên một đường dẫn có dấu cách.
   */
  async lookup(code: string): Promise<DossierResult | undefined> {
    const trimmed = code.trim();
    if (!trimmed) return undefined;

    if (appConfig.api.useMocks) {
      await mockDelay();
      return lookupMockDossier(trimmed);
    }

    try {
      const raw = await apiClient.get<ApiDossier>(`/dossiers/lookup/${encodeURIComponent(trimmed)}`);
      return toDossier(raw);
    } catch (err) {
      // 404 là câu trả lời nghiệp vụ hợp lệ ("không có hồ sơ nào mã này"),
      // không phải sự cố — các lỗi khác vẫn ném lên cho màn hình xử lý.
      if (err instanceof ApiError && err.status === HTTP_NOT_FOUND) {
        return undefined;
      }
      throw err;
    }
  },
};
