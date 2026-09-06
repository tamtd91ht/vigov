import type { BroadcastLog } from "@/types";
import { appConfig } from "@/config/app.config";
import { apiClient, buildQuery } from "@/services/api";
import { broadcastLogs as mockBroadcastLogs } from "@/mocks/cms";

/**
 * Lớp dịch vụ Thông báo — bọc endpoint /notifications của backend.
 *
 * Hai nhóm khác nhau dùng chung module này:
 * - Hộp thư của chính người đang đăng nhập (chuông trên thanh trên cùng).
 * - Lịch sử các lượt gửi hàng loạt (màn hình CMS · tab Thông báo).
 *
 * Khi `appConfig.api.useMocks === true`, chỉ lịch sử gửi có dữ liệu mẫu; hộp
 * thư trả rỗng vì không có dữ liệu mẫu tương ứng và chuông rỗng là trạng thái
 * hợp lệ, không phải lỗi.
 */

/** Một thông báo trong hộp thư cá nhân */
export interface InboxNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  /**
   * Dữ liệu kèm theo do backend gắn lúc gửi (`taskCode`, `feedbackCode`,
   * `documentId`, `templateKey`…). Giao diện dùng nó để suy ra bản ghi liên quan
   * — xem `notificationLink()`.
   */
  data: Record<string, string>;
}

export interface InboxPage {
  items: InboxNotification[];
  total: number;
  /** Số chưa đọc — dùng cho con số trên chuông */
  unread: number;
  page: number;
  limit: number;
}

/** Số thông báo tải về cho khay thả xuống của chuông */
const INBOX_PREVIEW_LIMIT = 10;

/**
 * Bản ghi thô của hộp thư. Backend dùng khoá chính `_id` và KHÔNG có trường
 * đường dẫn — điều hướng do giao diện suy ra từ `data`.
 */
interface RawNotification {
  _id: string;
  title?: string;
  body?: string;
  read?: boolean;
  createdAt?: string;
  data?: Record<string, string>;
}

function toInboxNotification(raw: RawNotification): InboxNotification {
  return {
    id: raw._id,
    title: raw.title ?? "",
    body: raw.body ?? "",
    read: raw.read ?? false,
    createdAt: raw.createdAt ?? "",
    data: raw.data ?? {},
  };
}

/**
 * Đường dẫn mở bản ghi liên quan tới một thông báo, hoặc `null` khi không suy được.
 *
 * Bảng khoá dưới đây là hợp đồng ngầm với backend (notification.consumer.ts,
 * feedback.service.ts): mỗi thông báo gắn sẵn mã bản ghi vào `data`. Văn bản chỉ
 * có `documentId` (_id trong CSDL) trong khi trang Văn bản mở ngăn chi tiết theo
 * SỐ ĐẾN, nên chỉ mở được phân hệ chứ chưa mở thẳng bản ghi.
 */
export function notificationLink(item: InboxNotification): string | null {
  const { taskCode, feedbackCode, documentId } = item.data;
  if (taskCode) return `/tasks?code=${encodeURIComponent(taskCode)}`;
  if (feedbackCode) return `/feedback?code=${encodeURIComponent(feedbackCode)}`;
  if (documentId) return "/documents";
  return null;
}

/** GET /notifications — hộp thư của người đang đăng nhập */
export async function fetchInbox(limit = INBOX_PREVIEW_LIMIT): Promise<InboxPage> {
  if (appConfig.api.useMocks) {
    return { items: [], total: 0, unread: 0, page: 1, limit };
  }
  const res = await apiClient.get<Omit<InboxPage, "items"> & { items: RawNotification[] }>(
    `/notifications${buildQuery({ page: 1, limit })}`,
  );
  return { ...res, items: (res.items ?? []).map(toInboxNotification) };
}

/** PATCH /notifications/:id/read — đánh dấu một thông báo đã đọc */
export async function markNotificationRead(id: string): Promise<void> {
  if (appConfig.api.useMocks) return;
  await apiClient.patch<RawNotification>(`/notifications/${encodeURIComponent(id)}/read`);
}

/**
 * Đánh dấu đã đọc nhiều thông báo một lượt.
 *
 * Backend CHƯA có endpoint "đọc tất cả" nên hàm này gọi lần lượt từng mã — chấp
 * nhận được vì chỉ áp dụng cho các thông báo đang hiển thị trong khay (tối đa
 * `INBOX_PREVIEW_LIMIT`). Một mã lỗi không được làm hỏng cả lượt, nên dùng
 * `allSettled` và trả về số thật sự thành công để giao diện báo đúng.
 */
export async function markNotificationsRead(ids: string[]): Promise<number> {
  const results = await Promise.allSettled(ids.map((id) => markNotificationRead(id)));
  return results.filter((r) => r.status === "fulfilled").length;
}

/** Bản ghi lịch sử gửi hàng loạt do backend trả về */
interface BroadcastApiItem {
  id: string;
  /** Backend hỗ trợ gửi nhiều kênh một lượt; giao diện hiện hiển thị kênh chính */
  channels: string[];
  audience: "citizen" | "internal";
  title: string;
  body: string;
  sentBy: string;
  total: number;
  delivered: number;
  failed: number;
  status: string;
  createdAt: string;
}

interface BroadcastApiPage {
  items: BroadcastApiItem[];
  total: number;
  page: number;
  limit: number;
}

/** Trạng thái backend → nhãn giao diện; giá trị lạ coi như đang gửi */
const BROADCAST_STATUS: Record<string, BroadcastLog["status"]> = {
  sent: "sent",
  sending: "sending",
  failed: "failed",
};

/** "2026-08-26T16:40:00.000Z" → "16:40 · 26/08/2026" */
function formatSentAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const day = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  return `${time} · ${day}`;
}

function toBroadcastLog(raw: BroadcastApiItem): BroadcastLog {
  return {
    id: raw.id,
    // Giao diện hiện chỉ hiển thị một kênh; lấy kênh đầu, mặc định push
    channel: raw.channels?.[0] === "zns" ? "zns" : "push",
    audience: raw.audience,
    title: raw.title,
    sentAt: formatSentAt(raw.createdAt),
    sentBy: raw.sentBy,
    total: raw.total,
    delivered: raw.delivered,
    status: BROADCAST_STATUS[raw.status] ?? "sending",
  };
}

/** Số dòng lịch sử gửi hiển thị trên màn hình CMS */
const BROADCAST_LIMIT = 20;

/** GET /notifications/broadcasts — lịch sử các lượt gửi hàng loạt */
export async function fetchBroadcastLogs(limit = BROADCAST_LIMIT): Promise<BroadcastLog[]> {
  if (appConfig.api.useMocks) return mockBroadcastLogs.map((log) => ({ ...log }));
  const res = await apiClient.get<BroadcastApiPage>(
    `/notifications/broadcasts${buildQuery({ page: 1, limit })}`,
  );
  return res.items.map(toBroadcastLog);
}
