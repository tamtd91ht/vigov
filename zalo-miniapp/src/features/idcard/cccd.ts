/**
 * Cơ chế đọc mã QR trên thẻ Căn cước công dân gắn chip — P5-11, tầng 2.
 * Xem quyết định kiến trúc 3 tầng ở `plans/p5-11-cccd-idcard.md`.
 *
 * QR mặt trước mã hoá 7 trường ngăn bằng ký tự `|`, KHÔNG mã hoá, KHÔNG ký số:
 *
 *   001099012345|123456789|Nguyễn Văn A|01011990|Nam|Số 1, Thôn Đông, …|15062021
 *   ─── số CCCD ─ CMND cũ ─ họ và tên ── ngsinh ─ GT ─ nơi thường trú ── ngày cấp
 *
 * Vì sao ưu tiên QR hơn OCR: đây là text gốc nên KHÔNG có sai số nhận dạng,
 * chạy offline, không tốn phí gọi API, và không phải gửi ảnh thẻ của công dân
 * cho dịch vụ bên thứ 3 (giảm nghĩa vụ theo Nghị định 13/2023/NĐ-CP).
 *
 * Giới hạn phải nói rõ với người dùng: QR không được ký số. Nó chống được lỗi
 * nhập liệu, KHÔNG chống được thẻ giả — ai cũng có thể in lại một mã QR. Muốn
 * xác thực thật phải đọc chip NFC (tầng 1), dữ liệu trong chip do Bộ Công an ký.
 *
 * CẢNH BÁO ĐỊNH DẠNG: bố cục trên đúng với CCCD gắn chip (mẫu 2021). Thẻ Căn
 * cước cấp sau 01/7/2024 theo Luật Căn cước 2023 CHƯA ĐƯỢC KIỂM CHỨNG. Vì vậy
 * parser dưới đây báo lỗi rõ ràng khi số trường không khớp, thay vì gán bừa
 * theo vị trí — gán sai còn tệ hơn không đọc được, vì dữ liệu hỏng sẽ được lưu
 * mà không ai biết.
 */

/** Thông tin trích từ thẻ căn cước, đã chuẩn hoá để hiển thị */
export interface CccdInfo {
  /** Số định danh cá nhân, 12 chữ số */
  id: string;
  /** Số CMND 9 hoặc 12 chữ số; rỗng nếu thẻ không mang thông tin này */
  oldId: string;
  fullName: string;
  /** dd/MM/yyyy */
  dateOfBirth: string;
  gender: string;
  /** Nơi thường trú, giữ nguyên văn trên thẻ */
  residence: string;
  /** dd/MM/yyyy */
  issuedDate: string;
}

/** Kết quả parse — buộc nơi gọi xử lý nhánh lỗi, không trả về đối tượng rỗng */
export type CccdParseResult =
  | { ok: true; data: CccdInfo; raw: string }
  | { ok: false; errors: string[]; raw: string };

/** Thứ tự 7 trường trong chuỗi QR — dùng cả để parse lẫn để hiển thị sơ đồ ánh xạ */
export const CCCD_FIELD_ORDER: ReadonlyArray<{ key: keyof CccdInfo; label: string }> = [
  { key: "id", label: "Số CCCD" },
  { key: "oldId", label: "Số CMND cũ" },
  { key: "fullName", label: "Họ và tên" },
  { key: "dateOfBirth", label: "Ngày sinh" },
  { key: "gender", label: "Giới tính" },
  { key: "residence", label: "Nơi thường trú" },
  { key: "issuedDate", label: "Ngày cấp" },
];

const FIELD_COUNT = CCCD_FIELD_ORDER.length;
const CCCD_DIGITS = 12;
/** Số CMND hợp lệ: 9 chữ số (mẫu cũ) hoặc 12 chữ số (mẫu 2016) */
const OLD_ID_DIGITS = [9, 12];

/**
 * Đổi ngày dạng ddMMyyyy trên thẻ sang dd/MM/yyyy để hiển thị.
 * Trả null nếu không phải ngày có thật — bắt được cả `31021990`, thứ mà kiểm
 * tra bằng biểu thức chính quy đơn thuần sẽ cho lọt.
 */
function parseCompactDate(value: string): string | null {
  if (!/^\d{8}$/.test(value)) return null;
  const day = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const year = Number(value.slice(4, 8));

  const date = new Date(year, month - 1, day);
  const isRealDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!isRealDate) return null;

  return `${value.slice(0, 2)}/${value.slice(2, 4)}/${year}`;
}

/**
 * Che số định danh khi ghi log hoặc hiển thị ở nơi không cần đủ số.
 * `001099012345` → `0010****2345`. Số CCCD là dữ liệu cá nhân, không để nguyên
 * văn trong nhật ký ứng dụng (xem mục rà soát ở SECURITY.md).
 */
export function maskCccd(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}${"*".repeat(id.length - 8)}${id.slice(-4)}`;
}

/**
 * Phân tích chuỗi đọc được từ QR thành thông tin có cấu trúc.
 *
 * Nguyên tắc: thà từ chối còn hơn đoán. Mỗi trường sai sinh một thông báo
 * tiếng Việt cụ thể để màn hình chỉ đúng chỗ hỏng cho người dùng, thay vì
 * báo chung chung "mã QR không hợp lệ".
 */
export function parseCccdQr(raw: string): CccdParseResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, errors: ["Không đọc được nội dung nào từ mã QR."], raw };
  }

  const parts = trimmed.split("|");
  if (parts.length !== FIELD_COUNT) {
    return {
      ok: false,
      raw,
      errors: [
        `Mã QR có ${parts.length} trường, trong khi thẻ CCCD gắn chip có ${FIELD_COUNT}. ` +
          `Nhiều khả năng đây không phải QR trên thẻ căn cước, hoặc là mẫu thẻ Căn cước ` +
          `cấp sau 01/7/2024 mà ứng dụng chưa hỗ trợ. Vui lòng nhập tay.`,
      ],
    };
  }

  const [id, oldId, fullName, birthRaw, gender, residence, issuedRaw] = parts.map((p) => p.trim());
  const errors: string[] = [];

  if (!new RegExp(`^\\d{${CCCD_DIGITS}}$`).test(id)) {
    errors.push(`Số CCCD phải gồm đúng ${CCCD_DIGITS} chữ số, đọc được: “${id}”.`);
  }
  // CMND cũ được phép rỗng: thẻ cấp cho người chưa từng có CMND không mang trường này
  if (oldId && !OLD_ID_DIGITS.includes(oldId.length)) {
    errors.push(`Số CMND cũ phải gồm ${OLD_ID_DIGITS.join(" hoặc ")} chữ số, đọc được: “${oldId}”.`);
  }
  if (!fullName) {
    errors.push("Thiếu họ và tên.");
  }

  const dateOfBirth = parseCompactDate(birthRaw);
  if (!dateOfBirth) {
    errors.push(`Ngày sinh không đúng định dạng ddMMyyyy hoặc không có thật: “${birthRaw}”.`);
  }

  const issuedDate = parseCompactDate(issuedRaw);
  if (!issuedDate) {
    errors.push(`Ngày cấp không đúng định dạng ddMMyyyy hoặc không có thật: “${issuedRaw}”.`);
  }

  if (!residence) {
    errors.push("Thiếu nơi thường trú.");
  }

  if (errors.length > 0) return { ok: false, errors, raw };

  return {
    ok: true,
    raw,
    data: {
      id,
      oldId,
      fullName,
      dateOfBirth: dateOfBirth as string,
      gender,
      residence,
      issuedDate: issuedDate as string,
    },
  };
}
