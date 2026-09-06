/**
 * Dữ liệu seed phân hệ Hồ sơ một cửa (WBS #15)
 * — port từ zalo-miniapp/src/mocks/dossier.mock.ts và
 *   mobile/lib/mocks/dossier_mock.dart (3 hồ sơ mẫu, ngữ cảnh xã Đại Thắng).
 *
 * Giữ NGUYÊN mã hồ sơ, tên thủ tục, người nộp, cán bộ phụ trách và mốc thời
 * gian của mock để bản demo trước và sau khi nối API cho cùng kết quả.
 *
 * Chuyển đổi so với mock:
 *   • `currentStep` (1-based) → `status` theo DOSSIER_STEP_KEYS;
 *   • `officer` gộp "Tên — Bộ phận" → tách thành `assignee` + `department`;
 *   • `submittedAt`/`expectedAt` chuỗi hiển thị → Date;
 *   • `stepTimes` suy ra từ mốc tiếp nhận, chia đều tới hạn trả kết quả —
 *     mock không có mốc từng bước, mà API phải trả `steps[].at`.
 *   • `applicantPhone` KHÔNG có trong mock (giao diện không hiển thị số) nên
 *     đặt số demo tất định ở đây; API luôn trả bản đã che.
 */
import { DOSSIER_STEP_KEYS, type Dossier } from '@vigov/shared';
import { endOfVnDay, parseVnDateTime } from './seed.util';

export type DossierSeed = Partial<Dossier> & { code: string };

/** Mô tả một hồ sơ mẫu theo đúng các trường của mock */
interface DossierMock {
  code: string;
  procedure: string;
  applicant: string;
  applicantPhone: string;
  assignee: string;
  department: string;
  /** 1-based, 1..4 — khớp `currentStep` của mock */
  currentStep: number;
  /** dd/MM/yyyy HH:mm */
  submittedAt: string;
  /** dd/MM/yyyy — hạn trả kết quả trên giấy hẹn */
  expectedAt: string;
  note: string;
}

const MOCKS: DossierMock[] = [
  {
    code: 'HS-2026-04182',
    procedure: 'Cấp bản sao trích lục khai sinh',
    applicant: 'Nguyễn Văn Hùng',
    applicantPhone: '0912480311',
    assignee: 'Trần Thị Lan',
    department: 'Tư pháp, Hộ tịch',
    currentStep: 2,
    submittedAt: '24/08/2026 09:15',
    expectedAt: '27/08/2026',
    note: 'Hồ sơ đầy đủ, đang đối chiếu sổ gốc đăng ký khai sinh.',
  },
  {
    code: 'HS-2026-03957',
    procedure: 'Xác nhận tình trạng hôn nhân',
    applicant: 'Phạm Thị Mai',
    applicantPhone: '0987153962',
    assignee: 'Trần Thị Lan',
    department: 'Tư pháp, Hộ tịch',
    currentStep: 4,
    submittedAt: '15/08/2026 14:20',
    expectedAt: '20/08/2026',
    note: 'Đã có kết quả — mời công dân đến bộ phận một cửa nhận trong giờ hành chính.',
  },
  {
    code: 'HS-2026-04101',
    procedure: 'Đăng ký biến động đất đai',
    applicant: 'Lê Đình Quang',
    applicantPhone: '0932194107',
    assignee: 'Vũ Minh Đức',
    department: 'Địa chính, Xây dựng',
    currentStep: 3,
    submittedAt: '19/08/2026 10:40',
    expectedAt: '02/09/2026',
    note: 'Đã thẩm định xong, đang trình lãnh đạo ký kết quả.',
  },
];

/** Nhãn hiển thị của từng bước để ghi vào nhật ký cho người đọc */
const TIMELINE_TITLES = [
  'Tiếp nhận hồ sơ tại bộ phận một cửa',
  'Thẩm định, xử lý hồ sơ',
  'Trình lãnh đạo ký kết quả',
  'Trả kết quả cho công dân',
];

/** dd/MM/yyyy HH:mm — cùng định dạng nhật ký của Nhiệm vụ và Phản ánh */
function timeLabel(value: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(value.getDate())}/${p(value.getMonth() + 1)}/${value.getFullYear()} ${p(value.getHours())}:${p(value.getMinutes())}`;
}

/**
 * Mốc vào từng bước đã đi qua.
 * Mock chỉ có ngày nộp và ngày hẹn trả, nên chia đều khoảng giữa hai mốc cho
 * các bước — đủ để tracker hiển thị mốc thời gian hợp lý và TẤT ĐỊNH.
 */
function buildStepTimes(submitted: Date, due: Date, currentStep: number) {
  const span = Math.max(due.getTime() - submitted.getTime(), 0);
  const slot = span / DOSSIER_STEP_KEYS.length;
  return DOSSIER_STEP_KEYS.slice(0, currentStep).map((key, index) => ({
    key,
    at: index === 0 ? submitted : new Date(submitted.getTime() + slot * index),
  }));
}

export const DOSSIER_SEED: DossierSeed[] = MOCKS.map((mock) => {
  const submittedAt = parseVnDateTime(mock.submittedAt);
  const dueAt = endOfVnDay(mock.expectedAt);
  const stepTimes = buildStepTimes(submittedAt, dueAt, mock.currentStep);

  return {
    code: mock.code,
    procedure: mock.procedure,
    applicantName: mock.applicant,
    applicantPhone: mock.applicantPhone,
    department: mock.department,
    assignee: mock.assignee,
    status: DOSSIER_STEP_KEYS[mock.currentStep - 1],
    submittedAt,
    dueAt,
    note: mock.note,
    stepTimes,
    timeline: stepTimes.map((step, index) => ({
      title: TIMELINE_TITLES[index],
      meta: `${timeLabel(step.at)} · ${mock.assignee} — ${mock.department}`,
      state: index === stepTimes.length - 1 ? 'cur' : 'ok',
    })),
  };
});
