import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { FilesService } from '../../files/files.service';
import {
  OCR_FIELD_DEFS,
  type OcrExtractResult,
  type OcrExtractedField,
  type OcrProvider,
  type OcrRuntimeConfig,
} from './ocr.provider';

/**
 * Provider OCR dùng dịch vụ MIỄN PHÍ ocr.space — CHỈ ĐỂ DÙNG THỬ.
 *
 * VÌ SAO CÓ TỆP NÀY: trước khi khách trả phí hàng tháng cho một nhà cung cấp
 * thật (câu hỏi mở #1), cần một bản chạy được để xem OCR đọc văn bản hành chính
 * Việt Nam tới đâu. Bản `mock` trả dữ liệu cứng nên không trả lời được câu đó.
 *
 * ⚠ KHÔNG ĐƯỢC DÙNG CHO DỮ LIỆU THẬT. Đây là dịch vụ miễn phí đặt ở nước ngoài:
 * bản scan gửi lên là văn bản hành chính, có thể chứa họ tên, địa chỉ, số điện
 * thoại của công dân. Gửi ra ngoài như vậy chưa có cơ sở pháp lý theo NĐ
 * 13/2023 và chưa có thoả thuận xử lý dữ liệu với nhà cung cấp. Chỉ chạy trên
 * máy phát triển, với văn bản mẫu tự tạo.
 *
 * CÁCH KIỂM SOÁT: provider chạy ở môi trường nào cũng như nhau — mã KHÔNG phân
 * biệt production / dev, vì một nhánh `if` theo môi trường chỉ làm hành vi khác
 * nhau giữa nơi kiểm thử và nơi chạy thật, tức là chỗ dễ sai nhất lại là chỗ
 * không ai thử tới. Thay vào đó có hai thứ luôn bật:
 *
 *   1. `notice` trả kèm kết quả → giao diện hiện cảnh báo cho cán bộ ngay lúc
 *      họ dùng tính năng, để người quyết định biết dữ liệu đi đâu.
 *   2. Một dòng `warn` mỗi lượt gọi → vết trong nhật ký cho việc dữ liệu rời
 *      khỏi hệ thống.
 *
 * Chọn dùng provider nào là quyết định của người quản trị qua `OCR_PROVIDER`, và
 * người đó chịu trách nhiệm với dữ liệu đưa vào. Muốn dùng cho dữ liệu THẬT thì
 * chọn nhà cung cấp có thoả thuận xử lý dữ liệu cá nhân — xem SECURITY.md.
 *
 * Giới hạn của bậc miễn phí (tại thời điểm 10/09/2026): 25.000 lượt/tháng,
 * mỗi tệp tối đa 1MB, PDF tối đa 3 trang. Vượt hạn mức thì dịch vụ trả lỗi.
 */

/**
 * Cảnh báo hiện cho cán bộ mỗi lần dùng provider này. Văn phong hành chính,
 * nói rõ dữ liệu đi đâu và nên dùng với loại văn bản nào — không dùng thuật ngữ
 * kỹ thuật vì người đọc là cán bộ tiếp nhận văn bản, không phải lập trình viên.
 */
const PROVIDER_NOTICE =
  'Đang dùng dịch vụ nhận dạng chữ miễn phí đặt tại nước ngoài. Bản scan sẽ được ' +
  'gửi ra ngoài hệ thống để đọc chữ. Chỉ nên dùng với văn bản mẫu hoặc văn bản ' +
  'không chứa thông tin cá nhân của công dân.';

/** Ngưỡng kích thước tệp của bậc miễn phí — vượt là dịch vụ từ chối */
const FREE_TIER_MAX_BYTES = 1024 * 1024;

/** Hết thời gian chờ thì bỏ, không để cán bộ ngồi nhìn màn hình treo */
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Mã ngôn ngữ của ocr.space. Bậc miễn phí (engine 1) KHÔNG có tiếng Việt, nên
 * phải dùng engine 2 — engine này bỏ tham số `language` và tự nhận dạng.
 */
const OCR_ENGINE = '2';

/**
 * Điểm cuối mặc định của dịch vụ. Đây là địa chỉ CỐ ĐỊNH của ocr.space, không
 * phải giá trị thay đổi theo xã/phường — nhưng vẫn cho ghi đè qua OCR_ENDPOINT
 * để dùng được bản tự dựng hoặc máy chủ trung chuyển trong mạng nội bộ.
 */
const DEFAULT_ENDPOINT = 'https://api.ocr.space/parse/image';

interface OcrSpaceResponse {
  ParsedResults?: Array<{ ParsedText?: string }>;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
}

@Injectable()
export class OcrSpaceProvider implements OcrProvider {
  private readonly logger = new Logger(OcrSpaceProvider.name);

  // Không nhận ConfigService: cấu hình (khoá, điểm cuối) do OcrService giải
  // quyết theo luật ưu tiên rồi truyền vào `extract`
  constructor(private readonly files: FilesService) {}

  async extract(fileRef: string, config: OcrRuntimeConfig): Promise<OcrExtractResult> {
    // Ghi vết mỗi lượt gọi: đây là lúc một bản scan rời khỏi hệ thống ra máy chủ
    // nước ngoài, nên phải có dấu trong nhật ký để rà lại được sau này.
    //
    // KHÔNG ghi tên tệp: tên bản scan do cán bộ đặt, thực tế hay chứa số hồ sơ
    // hoặc tên công dân — ghi vào log là lộ dữ liệu cá nhân qua đường nhật ký.
    this.logger.warn(
      'Gửi một bản scan sang dịch vụ OCR miễn phí ocr.space (máy chủ nước ngoài). ' +
        'Chỉ dùng với văn bản mẫu; văn bản thật của công dân cần nhà cung cấp có ' +
        'thoả thuận xử lý dữ liệu cá nhân — xem SECURITY.md.',
    );

    const apiKey = (config.apiKey ?? '').trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Chưa có khoá API cho nhà cung cấp OCR "ocrspace". Vui lòng nhập khoá ở trang ' +
          'Cấu hình → Tích hợp, hoặc đặt biến OCR_API_KEY. Khoá miễn phí lấy tại ocr.space/ocrapi.',
      );
    }

    const { file, buffer } = await this.files.getContent(fileRef);

    if (buffer.byteLength > FREE_TIER_MAX_BYTES) {
      throw new ServiceUnavailableException(
        `Bản scan ${Math.round(buffer.byteLength / 1024)}KB vượt hạn mức 1MB của bậc miễn phí ocr.space. ` +
          'Vui lòng dùng tệp nhỏ hơn để thử nghiệm.',
      );
    }

    const endpoint = (config.endpoint ?? '').trim() || DEFAULT_ENDPOINT;
    const text = await this.callOcrSpace(buffer, file.mimeType, apiKey, file.originalName, endpoint);
    return { fields: parseAdministrativeDocument(text), notice: PROVIDER_NOTICE };
  }

  /** Gọi ocr.space, trả về toàn bộ văn bản đọc được */
  private async callOcrSpace(
    buffer: Buffer,
    mimeType: string,
    apiKey: string,
    originalName: string,
    endpoint: string,
  ): Promise<string> {
    const form = new FormData();
    /* PHẢI gửi kèm tên tệp CÓ ĐUÔI: ocr.space nhận diện loại tệp qua đuôi tên,
       gửi tên trống hay tên không đuôi thì dịch vụ trả lỗi E216 dù Content-Type
       đã đúng. Đã vấp lỗi này khi chạy thử thật ngày 10/09/2026. */
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), safeFileName(originalName, mimeType));
    form.append('OCREngine', OCR_ENGINE);
    // Giữ nguyên bố cục dòng: văn bản hành chính đọc theo dòng mới suy ra được trường
    form.append('isTable', 'true');

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { apikey: apiKey },
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err: unknown) {
      // Không đưa nội dung tệp vào thông báo lỗi — chỉ nói vì sao hỏng
      const reason = err instanceof Error ? err.message : 'không rõ nguyên nhân';
      throw new ServiceUnavailableException(`Không gọi được dịch vụ OCR: ${reason}`);
    }

    if (!res.ok) {
      throw new ServiceUnavailableException(`Dịch vụ OCR trả lỗi HTTP ${res.status}`);
    }

    const body = (await res.json()) as OcrSpaceResponse;
    if (body.IsErroredOnProcessing) {
      const msg = Array.isArray(body.ErrorMessage)
        ? body.ErrorMessage.join('; ')
        : (body.ErrorMessage ?? 'không rõ nguyên nhân');
      throw new ServiceUnavailableException(`Dịch vụ OCR không đọc được tệp: ${msg}`);
    }

    return (body.ParsedResults ?? []).map((r) => r.ParsedText ?? '').join('\n');
  }
}

/** Đuôi tệp suy ra từ kiểu MIME, dùng khi tên gốc không có đuôi dùng được */
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/tiff': 'tif',
  'image/bmp': 'bmp',
  'application/pdf': 'pdf',
};

/**
 * Tên tệp gửi kèm cho ocr.space.
 *
 * Hai việc: (1) BẢO ĐẢM có đuôi, vì thiếu đuôi là dịch vụ trả lỗi E216;
 * (2) KHÔNG gửi tên gốc đi. Tên bản scan do cán bộ đặt, thực tế hay chứa số
 * hồ sơ hoặc tên công dân — đưa ra dịch vụ ngoài là lộ dữ liệu cá nhân qua
 * đường tên tệp, đúng thứ `du-lieu-ca-nhan.md` cấm. Nên chỉ giữ lại phần đuôi.
 */
export function safeFileName(originalName: string, mimeType: string): string {
  // Bản ghi cũ có thể thiếu originalName — không được để hỏng cả lượt OCR vì tên tệp
  const fromName = (originalName ?? '').match(/\.([A-Za-z0-9]{1,5})$/)?.[1]?.toLowerCase();
  const ext = EXT_BY_MIME[(mimeType ?? '').toLowerCase()] ?? fromName ?? 'png';
  return `scan.${ext}`;
}

/**
 * Dò mức đầu tiên khớp và trả về TÊN CHUẨN của mức đó, rỗng nếu không có.
 * Thứ tự trong danh sách là thứ tự ưu tiên — mức bao hàm mức khác đứng trước.
 */
function matchLevel(text: string, levels: ReadonlyArray<[RegExp, string]>): string {
  return levels.find(([re]) => re.test(text))?.[1] ?? '';
}

/**
 * Suy ra 7 trường chuẩn từ khối văn bản thô.
 *
 * ocr.space chỉ trả CHỮ, không trả trường có cấu trúc — nên phần suy ra trường
 * là việc của mình. Đây là bộ luật đơn giản dựa trên cách trình bày quen thuộc
 * của văn bản hành chính Việt Nam, đủ để đánh giá chất lượng đọc chữ; nhà cung
 * cấp trả phí thường trả sẵn trường nên sẽ không cần tới hàm này.
 *
 * Độ tin cậy đặt 0.5 cho trường suy ra được: cố ý ĐỂ THẤP, vì con số này quyết
 * định cán bộ có phải rà lại hay không. Bịa ra 0.9 cho một phép dò chuỗi là nói
 * dối người dùng cuối. Trường không dò được trả rỗng với độ tin cậy 0.
 */
export function parseAdministrativeDocument(text: string): OcrExtractedField[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const joined = lines.join('\n');

  /** Độ tin cậy cho trường dò được bằng luật chuỗi — thấp có chủ đích */
  const RULE_CONFIDENCE = 0.5;

  const found: Record<string, string> = {};

  // Số ký hiệu: "Số: 1245/UBND-VP" — dạng <số>/<chữ viết tắt>
  const refNo = joined.match(/S[ốô]\s*:?\s*(\d+\s*\/\s*[A-ZĐ][A-ZĐ0-9-]*(?:-[A-ZĐ0-9]+)*)/);
  if (refNo) found.refNo = refNo[1].replace(/\s+/g, '');

  // Ngày ban hành: "ngày 12 tháng 03 năm 2026" hoặc "12/03/2026"
  const longDate = joined.match(/ng[àa]y\s+(\d{1,2})\s+th[áa]ng\s+(\d{1,2})\s+n[ăa]m\s+(\d{4})/i);
  if (longDate) {
    const [, d, m, y] = longDate;
    found.issuedDate = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  } else {
    const shortDate = joined.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
    if (shortDate) found.issuedDate = shortDate[1];
  }

  // Cơ quan ban hành: dòng viết hoa ở đầu văn bản, bỏ dòng quốc hiệu
  const QUOC_HIEU = /C[ỘO]NG\s*H[ÒO]A|Đ[ỘO]C\s*L[ẬA]P|T[Ự U]\s*DO/i;
  const sender = lines
    .slice(0, 8)
    .find((l) => l === l.toUpperCase() && l.length > 5 && !QUOC_HIEU.test(l));
  if (sender) found.sender = sender;

  // Trích yếu: đoạn sau "V/v" — nội dung chính của văn bản
  const summary = joined.match(/V\/v\s+([^\n]{5,200})/i);
  if (summary) found.summary = summary[1].trim();

  /* Hạn xử lý: "trước ngày 20/03/2026" / "hạn 20/03/2026".
     Phải dò riêng chứ không lấy ngày thứ hai trong văn bản: nhiều văn bản có
     ngày tháng ở phần nội dung không phải hạn, lấy nhầm là cán bộ bị nhắc sai
     hạn. Chỉ nhận khi có từ khoá chỉ hạn đứng trước. */
  const deadline = joined.match(
    /(?:tr[ưu][ớo]c\s+ng[àa]y|h[ạa]n\s*(?:x[ửu]\s*l[ýy])?\s*:?\s*(?:ng[àa]y\s*)?)\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
  );
  if (deadline) found.deadline = deadline[1];

  /* Độ mật / độ khẩn: TRẢ VỀ ĐÚNG THUẬT NGỮ NGHIỆP VỤ, không trả nguyên văn
     chuỗi OCR đọc được. Lý do: chuỗi khớp có thể đến từ NHÃN ("Độ khẩn:") chứ
     không phải từ giá trị, nên viết hoa/thường không ổn định. Hai trường này
     về sau đối chiếu với danh mục, lệch một chữ hoa là không khớp. */
  found.confidentiality = matchLevel(joined, [
    // Mức bao hàm mức khác phải đứng TRƯỚC: "Tuyệt mật" chứa "mật"
    [/tuy[ệe]t\s*m[ậa]t/i, 'Tuyệt mật'],
    [/t[ốo]i\s*m[ậa]t/i, 'Tối mật'],
    [/m[ậa]t/i, 'Mật'],
  ]);
  found.urgency = matchLevel(joined, [
    [/h[ỏo]a\s*t[ốo]c/i, 'Hỏa tốc'],
    [/th[ượu][ợơ]ng\s*kh[ẩa]n/i, 'Thượng khẩn'],
    [/kh[ẩa]n/i, 'Khẩn'],
  ]);

  return OCR_FIELD_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    value: found[def.key] ?? '',
    confidence: found[def.key] ? RULE_CONFIDENCE : 0,
  }));
}
