import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DOSSIER_STEP_KEYS,
  DOSSIER_STEP_LABELS,
  Dossier,
  type DossierDocument,
  type DossierStepKey,
} from '@vigov/shared';

/**
 * Che số điện thoại — GIỮ NGUYÊN cách của UsersService.maskPhone
 * ("0987654321" → "098•••321"). Không import UsersService vào đây để module
 * tra cứu công khai không kéo theo cả phân hệ Người dùng; hằng số phải khớp,
 * nên đặt cạnh nhau kèm chú thích này.
 */
const PHONE_MASK_HEAD = 3;
const PHONE_MASK_TAIL = 3;
const PHONE_MASK_FILL = '•••';

/** Một bước trong tracker trả về cho client */
export interface DossierStepView {
  key: DossierStepKey;
  label: string;
  /** ISO 8601, null khi hồ sơ chưa đi tới bước này */
  at: string | null;
  done: boolean;
}

/** Kết quả tra cứu hồ sơ — hợp đồng dùng chung cho Zalo Mini App và Web Quản trị */
export interface DossierLookupView {
  code: string;
  procedure: string;
  applicantName: string;
  /** Đã che, không bao giờ là số thật */
  applicantPhone: string;
  department: string;
  assignee: string;
  status: string;
  submittedAt: string | null;
  dueAt: string | null;
  note: string;
  steps: DossierStepView[];
}

@Injectable()
export class DossiersService {
  constructor(@InjectModel(Dossier.name) private readonly dossierModel: Model<DossierDocument>) {}

  /**
   * Tra cứu hồ sơ theo mã in trên giấy tiếp nhận.
   *
   * Mã được chuẩn hoá trước khi truy vấn: cắt khoảng trắng hai đầu và đưa về
   * chữ HOA. Công dân gõ lại mã từ giấy hoặc quét QR nên rất hay lẫn
   * "hs-2026-04182" hay " HS-2026-04182 " — không chuẩn hoá thì hồ sơ có thật
   * vẫn báo không tìm thấy, và đây là màn hình đầu tiên người dân dùng.
   */
  async lookup(rawCode: string): Promise<DossierLookupView> {
    const code = normalizeCode(rawCode);
    const doc = code ? await this.dossierModel.findOne({ code }).lean().exec() : null;
    if (!doc) {
      throw new NotFoundException(
        `Không tìm thấy hồ sơ có mã "${rawCode.trim()}". Vui lòng kiểm tra lại mã in trên giấy tiếp nhận hồ sơ.`,
      );
    }
    return toLookupView(doc);
  }
}

/** Chuẩn hoá mã tra cứu: bỏ khoảng trắng hai đầu, đưa về chữ hoa */
export function normalizeCode(rawCode: string | undefined): string {
  return (rawCode ?? '').trim().toUpperCase();
}

/** Che số điện thoại: "0987654321" → "098•••321" */
export function maskPhone(phone: string | undefined): string {
  if (!phone) return '';
  if (phone.length <= PHONE_MASK_HEAD + PHONE_MASK_TAIL) return phone;
  return `${phone.slice(0, PHONE_MASK_HEAD)}${PHONE_MASK_FILL}${phone.slice(-PHONE_MASK_TAIL)}`;
}

/** Bản ghi hồ sơ đọc bằng `.lean()` — chỉ các trường phản hồi cần tới */
type DossierLean = Pick<
  Dossier,
  'code' | 'procedure' | 'applicantName' | 'applicantPhone' | 'department' | 'assignee' | 'status' | 'note'
> & {
  submittedAt?: Date | null;
  dueAt?: Date | null;
  stepTimes?: { key: string; at: Date }[];
};

/**
 * Dựng tracker 4 bước cho client.
 *
 * `done` được suy từ `status` chứ không lưu riêng: bước trước bước hiện tại là
 * đã xong; bước hiện tại chỉ tính là xong khi hồ sơ đã ở bước cuối
 * ('returned' — đã trả kết quả), vì lúc đó không còn gì đang chạy. Lưu thêm cờ
 * `done` cho từng bước là mở đường cho dữ liệu tự mâu thuẫn với `status`.
 */
export function toLookupView(doc: DossierLean): DossierLookupView {
  const statusIndex = DOSSIER_STEP_KEYS.indexOf(doc.status as DossierStepKey);
  const isFinal = statusIndex === DOSSIER_STEP_KEYS.length - 1;
  const atByKey = new Map((doc.stepTimes ?? []).map((step) => [step.key, step.at]));

  const steps: DossierStepView[] = DOSSIER_STEP_KEYS.map((key, index) => ({
    key,
    label: DOSSIER_STEP_LABELS[key],
    at: index <= statusIndex ? toIso(atByKey.get(key)) : null,
    done: index < statusIndex || (index === statusIndex && isFinal),
  }));

  return {
    code: doc.code,
    procedure: doc.procedure,
    applicantName: doc.applicantName,
    applicantPhone: maskPhone(doc.applicantPhone),
    department: doc.department ?? '',
    assignee: doc.assignee ?? '',
    status: doc.status,
    submittedAt: toIso(doc.submittedAt),
    dueAt: toIso(doc.dueAt),
    note: doc.note ?? '',
    steps,
  };
}

/** Date → ISO 8601; thiếu mốc thì trả null để client biết là "chưa tới bước này" */
function toIso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}
