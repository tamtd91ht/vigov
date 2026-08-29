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
  /** Loại sự kiện sinh ra thông báo (giao việc, quá hạn SLA, phản ánh mới…) */
  kind: string;
  read: boolean;
  createdAt: string;
  /** Đường dẫn trong Web Quản trị để mở thẳng bản ghi liên quan */
  link?: string;
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

/** GET /notifications — hộp thư của người đang đăng nhập */
export async function fetchInbox(limit = INBOX_PREVIEW_LIMIT): Promise<InboxPage> {
  if (appConfig.api.useMocks) {
    return { items: [], total: 0, unread: 0, page: 1, limit };
  }
  return apiClient.get<InboxPage>(`/notifications${buildQuery({ page: 1, limit })}`);
}

/** PATCH /notifications/:id/read — đánh dấu một thông báo đã đọc */
export async function markNotificationRead(id: string): Promise<void> {
  if (appConfig.api.useMocks) return;
  await apiClient.patch<InboxNotification>(`/notifications/${encodeURIComponent(id)}/read`);
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
