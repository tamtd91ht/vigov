import type { IncomingDocument, TimelineItem } from "@/types";
import { appConfig } from "@/config/app.config";
import { ApiError, apiClient, buildQuery, type Paged } from "@/services/api";
import { buildOcrFields, citizenPetitions, documentAttachments, incomingDocuments } from "@/mocks/documents";

/**
 * Lớp dịch vụ phân hệ Văn bản & Đơn thư — bọc các endpoint /documents và
 * /workflow/document-to-task của backend.
 *
 * Backend dùng `arrivalNo` (số đến) làm khoá đường dẫn, còn nút "Chuyển thành
 * công việc" lại cần `_id` của bản ghi, nên bản ghi trả về được bổ sung `id`.
 *
 * Khi `appConfig.api.useMocks === true`, service phục vụ dữ liệu từ
 * `src/mocks/documents.ts` để demo được lúc chưa có backend.
 */

/** Phân loại sổ: văn bản đến hay đơn thư công dân */
export type DocumentKind = "incoming" | "petition";

/** Một trường thông tin do OCR bóc tách từ bản scan */
export interface OcrField {
  key: string;
  label: string;
  value: string;
  confirmed: boolean;
  /** Độ tin cậy 0–1 do máy đọc trả về */
  confidence?: number;
}

/** Văn bản kèm các trường chỉ backend mới có (id, phân loại, kết quả OCR) */
export interface DocumentDetail extends IncomingDocument {
  /** _id của bản ghi — bắt buộc khi gọi /workflow/document-to-task */
  id: string;
  kind: DocumentKind;
  ocrFields: OcrField[];
  /** Mã nhiệm vụ đã sinh ra từ văn bản này (nếu có) */
  linkedTaskCode?: string;
  scanFileId?: string;
}

/** Bộ lọc + phân trang cho GET /documents (lọc phía máy chủ) */
export interface DocumentQuery {
  kind?: DocumentKind;
  status?: string;
  department?: string;
  docType?: string;
  /** Từ khoá tìm toàn văn theo trích yếu / số ký hiệu / nơi gửi */
  q?: string;
  page?: number;
  limit?: number;
}

/** Thân yêu cầu POST /documents */
export interface CreateDocumentInput {
  refNo: string;
  /** dd/MM/yyyy */
  date: string;
  sender: string;
  summary: string;
  docType?: string;
  kind?: DocumentKind;
  department?: string;
  /** dd/MM/yyyy, bỏ trống nếu văn bản không có hạn */
  deadline?: string;
  confidentiality?: string;
  urgency?: string;
  signer?: string;
  pageCount?: number;
  /** Mã tệp bản scan trong kho tệp dùng chung — điều kiện để chạy OCR */
  scanFileId?: string;
}

/** Thân yêu cầu PATCH /documents/:arrivalNo — mọi trường đều tuỳ chọn */
export interface UpdateDocumentInput extends Partial<Omit<CreateDocumentInput, "kind">> {
  status?: IncomingDocument["status"];
}

/** Thân yêu cầu POST /workflow/document-to-task */
export interface DocumentToTaskInput {
  /** _id của văn bản (DocumentDetail.id) */
  documentId: string;
  assignee?: string;
  department?: string;
  /** dd/MM/yyyy */
  deadline?: string;
}

/** Bản ghi thô backend trả về */
interface RawDocument extends IncomingDocument {
  _id: string;
  kind?: DocumentKind;
  ocrFields?: OcrField[];
  linkedTaskCode?: string;
  scanFileId?: string;
}

/** Phản hồi của các endpoint OCR — chỉ trả phần OCR, không trả cả văn bản */
interface OcrFieldsResponse {
  arrivalNo: string;
  ocrFields: OcrField[];
}

interface OcrFieldResponse {
  arrivalNo: string;
  field: OcrField;
}

/** Ánh xạ bản ghi backend sang kiểu dùng trong giao diện */
function toDocumentDetail(raw: RawDocument): DocumentDetail {
  const { _id, kind, ocrFields, timeline, ...rest } = raw;
  return {
    ...rest,
    id: _id,
    kind: kind ?? "incoming",
    ocrFields: ocrFields ?? [],
    timeline: timeline ?? [],
  };
}

/** Thông báo lỗi tiếng Việt để hiện toast sau thao tác ghi */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Thao tác không thành công, vui lòng thử lại";
}

/* ───────────────────────── Chế độ mock ───────────────────────── */

/** Kho dữ liệu mock giữ trong bộ nhớ để thao tác ghi vẫn phản hồi được khi demo */
let mockStore: DocumentDetail[] | null = null;

/**
 * Mock cũ đặt khoá trường ngày ban hành là "date", backend dùng "issuedDate" —
 * đổi lại cho khớp để giao diện chỉ cần biết một bộ khoá duy nhất.
 */
function mockOcrOf(doc: IncomingDocument): OcrField[] {
  return buildOcrFields(doc).map((f) => ({
    ...f,
    key: f.key === "date" ? "issuedDate" : f.key,
  }));
}

function store(): DocumentDetail[] {
  if (!mockStore) {
    mockStore = [
      ...incomingDocuments.map((d) => toMockDetail(d, "incoming")),
      ...citizenPetitions.map((d) => toMockDetail(d, "petition")),
    ];
  }
  return mockStore;
}

function toMockDetail(doc: IncomingDocument, kind: DocumentKind): DocumentDetail {
  return {
    ...doc,
    id: `mock-${kind}-${doc.arrivalNo}`,
    kind,
    ocrFields: mockOcrOf(doc),
    scanFileId: "mock-scan",
  };
}

function mockDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, appConfig.api.mockDelayMs));
}

/** Tìm văn bản mock theo số đến, ném lỗi 404 giống backend nếu không có */
function mockFind(arrivalNo: string): DocumentDetail {
  const found = store().find((d) => d.arrivalNo === arrivalNo);
  if (!found) throw new ApiError(`Không tìm thấy văn bản có số đến ${arrivalNo}`, 404);
  return found;
}

/** "dd/MM/yyyy" → số ngày còn lại tới hạn (âm = quá hạn) */
function daysLeftOf(deadline?: string): number {
  if (!deadline) return 0;
  const matched = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(deadline.trim());
  if (!matched) return 0;
  const due = new Date(Number(matched[3]), Number(matched[2]) - 1, Number(matched[1]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/* ───────────────────────── Đọc dữ liệu ───────────────────────── */

/** Danh sách văn bản đến / đơn thư có lọc + phân trang phía máy chủ */
export async function listDocuments(query: DocumentQuery = {}): Promise<Paged<DocumentDetail>> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  if (appConfig.api.useMocks) {
    await mockDelay();
    const keyword = query.q?.trim().toLowerCase() ?? "";
    const matched = store().filter(
      (d) =>
        (!query.kind || d.kind === query.kind) &&
        (!query.status || d.status === query.status) &&
        (!query.department || d.department === query.department) &&
        (!query.docType || d.docType === query.docType) &&
        (!keyword ||
          d.summary.toLowerCase().includes(keyword) ||
          d.refNo.toLowerCase().includes(keyword) ||
          d.sender.toLowerCase().includes(keyword)),
    );
    return {
      items: matched.slice((page - 1) * limit, page * limit),
      total: matched.length,
      page,
      limit,
    };
  }

  const res = await apiClient.get<Paged<RawDocument>>(
    `/documents${buildQuery({
      kind: query.kind,
      status: query.status,
      department: query.department,
      docType: query.docType,
      q: query.q,
      page,
      limit,
    })}`,
  );
  return {
    items: res.items.map(toDocumentDetail),
    total: res.total,
    page: res.page,
    limit: res.limit,
  };
}

/** Chi tiết một văn bản theo số đến */
export async function getDocument(arrivalNo: string): Promise<DocumentDetail> {
  if (appConfig.api.useMocks) {
    await mockDelay();
    return { ...mockFind(arrivalNo) };
  }
  return toDocumentDetail(await apiClient.get<RawDocument>(`/documents/${encodeURIComponent(arrivalNo)}`));
}

/* ───────────────────────── Thao tác ghi ───────────────────────── */

/** Tiếp nhận văn bản, vào sổ — backend tự cấp số đến */
export async function createDocument(input: CreateDocumentInput): Promise<DocumentDetail> {
  if (appConfig.api.useMocks) {
    await mockDelay();
    const kind = input.kind ?? "incoming";
    const list = store();
    const max = list
      .filter((d) => d.kind === kind)
      .reduce((acc, d) => Math.max(acc, Number.parseInt(d.arrivalNo.replace(/\D/g, ""), 10) || 0), 0);
    const arrivalNo = kind === "petition" ? `ĐT-${max + 1}` : String(max + 1);
    const timeline: TimelineItem[] = [
      {
        title: "Văn phòng tiếp nhận, vào sổ văn bản đến",
        meta: "Vừa xong · Trần Thị Hạnh",
        state: "cur",
      },
    ];
    const created: DocumentDetail = {
      id: `mock-${kind}-${arrivalNo}`,
      arrivalNo,
      refNo: input.refNo,
      date: input.date,
      sender: input.sender,
      summary: input.summary,
      deadline: input.deadline ?? "",
      daysLeft: daysLeftOf(input.deadline),
      department: input.department ?? "Văn phòng UBND",
      status: "moi",
      docType: input.docType ?? "Công văn",
      confidentiality: input.confidentiality ?? "Thường",
      urgency: input.urgency ?? "Thường",
      signer: input.signer ?? "",
      pageCount: input.pageCount ?? 1,
      timeline,
      kind,
      ocrFields: [],
      scanFileId: input.scanFileId,
    };
    list.unshift(created);
    return { ...created };
  }
  return toDocumentDetail(await apiClient.post<RawDocument>("/documents", input));
}

/** Cập nhật văn bản; đổi bộ phận / trạng thái sẽ được backend ghi thêm nhật ký */
export async function updateDocument(arrivalNo: string, input: UpdateDocumentInput): Promise<DocumentDetail> {
  if (appConfig.api.useMocks) {
    await mockDelay();
    const doc = mockFind(arrivalNo);
    if (input.department && input.department !== doc.department) {
      doc.timeline = [
        ...doc.timeline.map((s) => ({ ...s, state: "ok" as const })),
        {
          title: `Chuyển xử lý: ${doc.department} → ${input.department}`,
          meta: "Vừa xong · Trần Thị Hạnh",
          state: "cur",
        },
      ];
    }
    Object.assign(doc, input as Partial<DocumentDetail>);
    doc.daysLeft = daysLeftOf(doc.deadline);
    return { ...doc };
  }
  return toDocumentDetail(await apiClient.patch<RawDocument>(`/documents/${encodeURIComponent(arrivalNo)}`, input));
}

/** Chạy OCR trên bản scan đính kèm, trả về danh sách trường đã bóc tách */
export async function runDocumentOcr(arrivalNo: string): Promise<OcrField[]> {
  if (appConfig.api.useMocks) {
    await mockDelay();
    const doc = mockFind(arrivalNo);
    doc.ocrFields = mockOcrOf(doc);
    return doc.ocrFields.map((f) => ({ ...f }));
  }
  const res = await apiClient.post<OcrFieldsResponse>(`/documents/${encodeURIComponent(arrivalNo)}/ocr`);
  return res.ocrFields;
}

/** Cán bộ xác nhận một trường OCR (có thể sửa lại giá trị máy đọc sai) */
export async function confirmOcrField(arrivalNo: string, key: string, value?: string): Promise<OcrField> {
  if (appConfig.api.useMocks) {
    await mockDelay();
    const doc = mockFind(arrivalNo);
    const field = doc.ocrFields.find((f) => f.key === key);
    if (!field) throw new ApiError(`Văn bản không có trường OCR "${key}"`, 404);
    if (value !== undefined) field.value = value;
    field.confirmed = true;
    return { ...field };
  }
  const res = await apiClient.patch<OcrFieldResponse>(
    `/documents/${encodeURIComponent(arrivalNo)}/ocr/${encodeURIComponent(key)}/confirm`,
    value === undefined ? {} : { value },
  );
  return res.field;
}

/** Xác nhận toàn bộ trường OCR của văn bản */
export async function confirmAllOcr(arrivalNo: string): Promise<OcrField[]> {
  if (appConfig.api.useMocks) {
    await mockDelay();
    const doc = mockFind(arrivalNo);
    doc.ocrFields = doc.ocrFields.map((f) => ({ ...f, confirmed: true }));
    return doc.ocrFields.map((f) => ({ ...f }));
  }
  const res = await apiClient.post<OcrFieldsResponse>(`/documents/${encodeURIComponent(arrivalNo)}/confirm-all-ocr`);
  return res.ocrFields;
}

/**
 * Nút "Chuyển thành công việc": sinh nhiệm vụ theo dõi từ văn bản đến.
 * Backend idempotent — văn bản đã chuyển rồi thì trả lại đúng mã nhiệm vụ cũ.
 */
export async function createTaskFromDocument(input: DocumentToTaskInput): Promise<{ code: string }> {
  if (appConfig.api.useMocks) {
    await mockDelay();
    const doc = store().find((d) => d.id === input.documentId);
    if (!doc) throw new ApiError("Không tìm thấy văn bản đến", 404);
    if (!doc.linkedTaskCode) doc.linkedTaskCode = `NV-26${String(store().length + 90).slice(-2)}`;
    return { code: doc.linkedTaskCode };
  }
  return apiClient.post<{ code: string }>("/workflow/document-to-task", input);
}

/** Tệp đính kèm hiển thị trong drawer — kho tệp văn thư thật tích hợp sau (WBS #26) */
export const documentAttachmentNames = documentAttachments;
