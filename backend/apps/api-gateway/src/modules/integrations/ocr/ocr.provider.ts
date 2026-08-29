import { Injectable } from '@nestjs/common';

/**
 * Hợp đồng provider OCR (WBS #25 — task P3-25).
 * Mọi nhà cung cấp OCR (FPT.AI, Viettel, VNPT, Google Vision...) đều bọc lại
 * theo interface này để module Documents không phụ thuộc nhà cung cấp cụ thể.
 */

/** Một trường được OCR trích xuất từ bản scan */
export interface OcrExtractedField {
  /** Khoá kỹ thuật, khớp với OcrField.key trong document.schema */
  key: string;
  /** Nhãn tiếng Việt hiển thị cho cán bộ */
  label: string;
  /** Giá trị OCR đọc được */
  value: string;
  /** Độ tin cậy 0..1 do provider trả về */
  confidence: number;
}

export interface OcrExtractResult {
  fields: OcrExtractedField[];
}

export interface OcrProvider {
  /** Trích xuất thông tin từ tệp scan (fileRef = scanFileId trong file storage P3-24) */
  extract(fileRef: string): Promise<OcrExtractResult>;
}

/** Token DI cho provider OCR đang được chọn */
export const OCR_PROVIDER = 'VIGOV_OCR_PROVIDER';

/**
 * 7 trường chuẩn của văn bản hành chính Việt Nam.
 * Đặt hằng số ở đây để module Documents và provider dùng chung một bộ khoá.
 */
export const OCR_FIELD_DEFS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'refNo', label: 'Số ký hiệu' },
  { key: 'issuedDate', label: 'Ngày ban hành' },
  { key: 'sender', label: 'Cơ quan ban hành' },
  { key: 'summary', label: 'Trích yếu' },
  { key: 'deadline', label: 'Hạn xử lý' },
  { key: 'confidentiality', label: 'Độ mật' },
  { key: 'urgency', label: 'Độ khẩn' },
];

/** Khoảng độ tin cậy giả lập của bản mock */
const MOCK_CONFIDENCE_MIN = 0.82;
const MOCK_CONFIDENCE_MAX = 0.97;

/** Giá trị mẫu tương ứng từng trường — mô phỏng kết quả đọc một công văn đến */
const MOCK_VALUES: Record<string, string> = {
  refNo: '1245/UBND-VP',
  issuedDate: '12/03/2026',
  sender: 'UBND huyện Đông Anh',
  summary: 'V/v triển khai kế hoạch cải cách hành chính năm 2026 trên địa bàn xã',
  deadline: '20/03/2026',
  confidentiality: 'Thường',
  urgency: 'Khẩn',
};

/**
 * Provider OCR giả lập dùng cho Phase 1.
 *
 * LƯU Ý: provider OCR thật đang CHỜ KHÁCH CHỐT (câu hỏi mở #1) — khách hàng
 * tự đăng ký tài khoản/API key với nhà cung cấp, hệ thống chỉ đọc qua
 * ConfigService (`ocr.provider`, `ocr.apiKey`). Khi có nhà cung cấp chính thức,
 * bổ sung một lớp implements OcrProvider tương tự và đăng ký trong OcrService.
 */
@Injectable()
export class MockOcrProvider implements OcrProvider {
  async extract(fileRef: string): Promise<OcrExtractResult> {
    // Sinh độ tin cậy ổn định theo fileRef để gọi lại nhiều lần cho kết quả giống nhau
    const seed = hashCode(fileRef);
    const fields = OCR_FIELD_DEFS.map((def, index) => ({
      key: def.key,
      label: def.label,
      value: MOCK_VALUES[def.key] ?? '',
      confidence: mockConfidence(seed + index),
    }));
    return { fields };
  }
}

/** Băm chuỗi thành số nguyên dương — chỉ dùng để sinh dữ liệu giả lập ổn định */
function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000;
  }
  return Math.abs(hash);
}

/** Quy đổi seed về khoảng [MOCK_CONFIDENCE_MIN, MOCK_CONFIDENCE_MAX], làm tròn 2 chữ số */
function mockConfidence(seed: number): number {
  const steps = Math.round((MOCK_CONFIDENCE_MAX - MOCK_CONFIDENCE_MIN) * 100);
  const value = MOCK_CONFIDENCE_MIN + (seed % (steps + 1)) / 100;
  return Math.round(value * 100) / 100;
}
