import { Injectable } from '@nestjs/common';

/**
 * Hợp đồng provider đọc thẻ căn cước (P5-11 — tầng 3, OCR).
 *
 * TÁCH RIÊNG khỏi OcrProvider một cách có chủ ý: OcrProvider phục vụ văn bản
 * hành chính đến với 7 trường cố định (refNo, issuedDate, sender, summary,
 * deadline, confidentiality, urgency) — không khớp trường nào của thẻ căn cước.
 * Nhồi chung một interface sẽ làm hỏng cả hai bộ trường.
 *
 * Nhắc lại thứ tự ưu tiên trong `plans/p5-11-cccd-idcard.md`: OCR là TẦNG CUỐI.
 * Đường chính là quét QR (miễn phí, không sai số, xử lý ngay trên máy người
 * dùng) và đọc chip NFC (có chữ ký số của Bộ Công an). Provider ở đây chỉ dùng
 * cho CMND 9/12 số cũ, thẻ hỏng QR, và luồng cán bộ nhập tại quầy từ bản scan.
 *
 * TRƯỚC KHI NỐI PROVIDER THẬT: gửi ảnh thẻ lên dịch vụ bên thứ 3 là chuyển dữ
 * liệu cá nhân cho bên xử lý theo Nghị định 13/2023/NĐ-CP — cần sự đồng ý của
 * công dân và hợp đồng xử lý dữ liệu với nhà cung cấp. Nếu khách yêu cầu dữ
 * liệu không rời hạ tầng nội bộ thì phải mua SDK cài tại chỗ, không dùng API
 * cloud. Chốt với khách trước (câu hỏi mở #1).
 */

/** Một trường trích được từ ảnh thẻ */
export interface IdCardField {
  /** Khoá kỹ thuật, trùng bộ khoá QR ở mini app (features/idcard/cccd.ts) */
  key: string;
  /** Nhãn tiếng Việt hiển thị cho cán bộ */
  label: string;
  value: string;
  /** Độ tin cậy 0..1 do provider trả về */
  confidence: number;
}

export interface IdCardExtractResult {
  fields: IdCardField[];
}

export interface IdCardProvider {
  /** Trích thông tin từ ảnh thẻ (fileRef = fileId trong file storage P3-24) */
  extract(fileRef: string): Promise<IdCardExtractResult>;
}

/** Token DI cho provider đọc thẻ đang được chọn */
export const IDCARD_PROVIDER = 'VIGOV_IDCARD_PROVIDER';

/**
 * Bộ trường của thẻ căn cước — PHẢI khớp CCCD_FIELD_ORDER bên mini app
 * (`zalo-miniapp/src/features/idcard/cccd.ts`) để hai đường QR và OCR đổ về
 * cùng một hình dạng dữ liệu, tầng nghiệp vụ không phải phân biệt nguồn.
 */
export const IDCARD_FIELD_DEFS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'id', label: 'Số CCCD' },
  { key: 'oldId', label: 'Số CMND cũ' },
  { key: 'fullName', label: 'Họ và tên' },
  { key: 'dateOfBirth', label: 'Ngày sinh' },
  { key: 'gender', label: 'Giới tính' },
  { key: 'residence', label: 'Nơi thường trú' },
  { key: 'issuedDate', label: 'Ngày cấp' },
];

/** Khoảng độ tin cậy giả lập của bản mock */
const MOCK_CONFIDENCE_MIN = 0.84;
const MOCK_CONFIDENCE_MAX = 0.98;

/** Giá trị mẫu — KHÔNG phải người thật, số và địa chỉ đều bịa */
const MOCK_VALUES: Record<string, string> = {
  id: '001099012345',
  oldId: '123456789',
  fullName: 'Nguyễn Văn An',
  dateOfBirth: '01/01/1990',
  gender: 'Nam',
  residence: 'Số 1, Thôn Đông, Xã Đại Thắng, Huyện Phú Xuyên, Thành phố Hà Nội',
  issuedDate: '15/06/2021',
};

/**
 * Provider giả lập dùng cho bản trình diễn.
 * Nhà cung cấp thật (FPT.AI / VNPT eKYC / Viettel AI …) chờ khách chốt; khi có,
 * bổ sung một lớp implements IdCardProvider và đăng ký nhánh trong IdCardService.
 */
@Injectable()
export class MockIdCardProvider implements IdCardProvider {
  async extract(fileRef: string): Promise<IdCardExtractResult> {
    // Độ tin cậy sinh theo fileRef để gọi lại nhiều lần cho kết quả giống nhau
    const seed = hashCode(fileRef);
    const fields = IDCARD_FIELD_DEFS.map((def, index) => ({
      key: def.key,
      label: def.label,
      value: MOCK_VALUES[def.key] ?? '',
      confidence: mockConfidence(seed + index),
    }));
    return { fields };
  }
}

/** Băm chuỗi thành số nguyên dương — chỉ để sinh dữ liệu giả lập ổn định */
function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000;
  }
  return Math.abs(hash);
}

/** Quy đổi seed về [MOCK_CONFIDENCE_MIN, MOCK_CONFIDENCE_MAX], làm tròn 2 chữ số */
function mockConfidence(seed: number): number {
  const steps = Math.round((MOCK_CONFIDENCE_MAX - MOCK_CONFIDENCE_MIN) * 100);
  const value = MOCK_CONFIDENCE_MIN + (seed % (steps + 1)) / 100;
  return Math.round(value * 100) / 100;
}

/**
 * Che số định danh trước khi ghi log. Song song với maskCccd() bên mini app —
 * số CCCD là dữ liệu cá nhân, không để nguyên văn trong nhật ký máy chủ.
 */
export function maskCccd(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}${'*'.repeat(id.length - 8)}${id.slice(-4)}`;
}
