/**
 * Hợp đồng sự kiện đi qua RabbitMQ — dùng chung giữa các module (P3-30).
 * Tên sự kiện đặt theo dạng <miền>.<hành động>.
 */
export const EVENTS = {
  /** Văn bản được phân công bộ phận chủ trì → tạo nhiệm vụ theo dõi */
  DOCUMENT_ASSIGNED: 'document.assigned',
  /** Phản ánh được phân công cán bộ → tạo nhiệm vụ xử lý */
  FEEDBACK_ASSIGNED: 'feedback.assigned',
  /** Phản ánh xử lý xong → thông báo cho công dân */
  FEEDBACK_RESOLVED: 'feedback.resolved',
  /** Công dân gửi phản ánh mới → thông báo tiếp nhận */
  FEEDBACK_CREATED: 'feedback.created',
  /** Nhiệm vụ sắp đến hạn / quá hạn → nhắc người thực hiện */
  TASK_DEADLINE_WARNING: 'task.deadline.warning',
  /** Đề nghị giải ngân chờ duyệt */
  DISBURSEMENT_REQUESTED: 'disbursement.requested',
  /** Yêu cầu gửi thông báo (ZNS / push / in-app) */
  NOTIFICATION_REQUESTED: 'notification.requested',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export interface DocumentAssignedEvent {
  documentId: string;
  arrivalNo: string;
  summary: string;
  department: string;
  deadline: string;
  assignedBy: string;
}

export interface FeedbackAssignedEvent {
  feedbackId: string;
  code: string;
  title: string;
  categoryKey: string;
  department: string;
  assignee: string;
}

export interface FeedbackResolvedEvent {
  feedbackId: string;
  code: string;
  citizenPhone: string;
  title: string;
  resolvedAt: string;
}

export interface FeedbackCreatedEvent {
  feedbackId: string;
  code: string;
  citizenPhone: string;
  categoryKey: string;
  slaHours: number;
}

export interface TaskDeadlineWarningEvent {
  taskId: string;
  title: string;
  assignee: string;
  deadline: string;
  daysLeft: number;
}

export type NotificationChannel = 'zns' | 'push' | 'inapp';

export interface NotificationRequestedEvent {
  channels: NotificationChannel[];
  /** SĐT công dân (ZNS) hoặc username cán bộ (in-app) */
  recipient: string;
  templateKey: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}
