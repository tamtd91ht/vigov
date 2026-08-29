import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  EVENTS,
  type DocumentAssignedEvent,
  type FeedbackAssignedEvent,
  type NotificationRequestedEvent,
  type TaskDeadlineWarningEvent,
} from '@vigov/shared';
import { MessagingService, type QueueEnvelope } from '../messaging/messaging.service';
import { NotificationService } from './notification.service';

/* ─────────────────── Hằng số của consumer hàng đợi thông báo (P5-04) ─────────────────── */

/** Ngưỡng ngày còn lại để đổi giọng nhắc hạn từ "sắp đến hạn" sang "đã quá hạn" */
const OVERDUE_DAYS_LEFT = 0;

/**
 * Trường bổ sung WorkflowService gắn kèm khi phát sự kiện.
 *
 * Hợp đồng sự kiện gốc ở libs/shared/events KHÔNG chứa các trường này (và libs/shared
 * không được sửa trong task này), nên khai báo phần mở rộng tại chỗ tiêu thụ.
 * Consumer luôn coi chúng là tuỳ chọn để tin cũ trong hàng đợi vẫn xử lý được.
 */
interface AssignedExtras {
  /** Mã nhiệm vụ vừa sinh ra từ văn bản / phản ánh */
  taskCode?: string;
  /** Cán bộ thực nhận; rỗng nghĩa là giao cho cả bộ phận */
  assignee?: string;
}

/**
 * Consumer hàng đợi `vigov.notification` (P5-04).
 *
 * VÌ SAO KHÔNG DÙNG `connectMicroservice()` CỦA @nestjs/microservices:
 * transport RMQ của Nest mở kết nối ngay trong `startAllMicroservices()` ở main.ts.
 * Broker của khách đang ở trạng thái chặn publish vì hết đĩa, và trong nhiều tình
 * huống lỗi (mất mạng, sai quyền vhost) lời gọi đó treo hoặc ném lỗi làm sập cả quá
 * trình khởi động API Gateway. Consumer thủ công qua amqp-connection-manager dựng
 * kênh ở chế độ nền, tự thử lại, và tuyệt đối không chạm vào vòng đời khởi động —
 * đúng tiêu chí "broker chết thì nghiệp vụ chính vẫn chạy".
 *
 * Cơ chế tin lỗi: MessagingService gửi lại tối đa CONSUMER_MAX_RETRY lần rồi đẩy
 * sang hàng đợi chết `vigov.notification.dlq`.
 *
 * LƯU Ý VẬN HÀNH: hàng đợi bảo đảm "ít nhất một lần", nên một tin có thể được xử lý
 * lại sau khi kết nối đứt giữa chừng và sinh thông báo trùng. Phase 1 chấp nhận
 * (thông báo trùng vô hại); khi cần chống trùng thì thêm khoá idempotent theo
 * messageId vào NotificationService.
 */
@Injectable()
export class NotificationConsumer implements OnModuleInit {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(
    private readonly messaging: MessagingService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    // Không await: kênh dựng nền, broker chết cũng không chặn khởi động ứng dụng
    this.messaging.consume(this.messaging.notificationQueueName, (envelope) => this.handle(envelope));
  }

  /** Điều phối một tin theo tên sự kiện; sự kiện lạ được bỏ qua (ack) chứ không thử lại */
  private async handle(envelope: QueueEnvelope): Promise<void> {
    switch (envelope.event) {
      case EVENTS.DOCUMENT_ASSIGNED:
        return this.onDocumentAssigned(envelope.payload as DocumentAssignedEvent & AssignedExtras);
      case EVENTS.FEEDBACK_ASSIGNED:
        return this.onFeedbackAssigned(envelope.payload as FeedbackAssignedEvent & AssignedExtras);
      case EVENTS.TASK_DEADLINE_WARNING:
        return this.onTaskDeadlineWarning(envelope.payload as TaskDeadlineWarningEvent);
      case EVENTS.NOTIFICATION_REQUESTED:
        await this.notifications.send(envelope.payload as NotificationRequestedEvent);
        return;
      default:
        this.logger.warn(`Bỏ qua sự kiện không thuộc phạm vi thông báo: ${envelope.event}`);
    }
  }

  /** Văn bản đến đã có bộ phận chủ trì → báo cán bộ được giao, hoặc cả bộ phận */
  private async onDocumentAssigned(payload: DocumentAssignedEvent & AssignedExtras): Promise<void> {
    const title = `Văn bản ${payload.arrivalNo || payload.documentId} đã chuyển thành nhiệm vụ`;
    const body = `${payload.summary} — hạn xử lý ${payload.deadline}`;
    const data = {
      documentId: payload.documentId,
      taskCode: payload.taskCode ?? '',
      deadline: payload.deadline,
    };

    // Có cán bộ đích danh thì báo riêng; chưa có thì báo toàn bộ phận chủ trì
    if (payload.assignee && payload.assignee !== payload.department) {
      await this.notifications.notifyStaff(payload.assignee, title, body, data);
      return;
    }
    await this.notifications.notifyDepartment(payload.department, title, body, data);
  }

  /** Phản ánh đã phân công → nhắc cán bộ xử lý về nhiệm vụ vừa sinh */
  private async onFeedbackAssigned(payload: FeedbackAssignedEvent & AssignedExtras): Promise<void> {
    const title = `Phản ánh ${payload.code} đã chuyển thành nhiệm vụ ${payload.taskCode ?? ''}`.trim();
    const body = payload.title;
    const data = { feedbackCode: payload.code, taskCode: payload.taskCode ?? '' };

    const recipient = payload.assignee || payload.department;
    if (!recipient) {
      this.logger.warn(`Sự kiện ${EVENTS.FEEDBACK_ASSIGNED} cho ${payload.code} không có người nhận — bỏ qua`);
      return;
    }
    if (recipient === payload.department) {
      await this.notifications.notifyDepartment(payload.department, title, body, data);
      return;
    }
    await this.notifications.notifyStaff(recipient, title, body, data);
  }

  /** CronJob nhắc hạn → thông báo in-app cho người thực hiện nhiệm vụ */
  private async onTaskDeadlineWarning(payload: TaskDeadlineWarningEvent): Promise<void> {
    const overdue = payload.daysLeft <= OVERDUE_DAYS_LEFT;
    const title = overdue
      ? `Nhiệm vụ ${payload.taskId} ĐÃ QUÁ HẠN`
      : `Nhiệm vụ ${payload.taskId} sắp đến hạn`;
    const body = overdue
      ? `"${payload.title}" quá hạn ${Math.abs(payload.daysLeft)} ngày (hạn ${payload.deadline})`
      : `"${payload.title}" còn ${payload.daysLeft} ngày (hạn ${payload.deadline})`;

    await this.notifications.notifyStaff(payload.assignee, title, body, {
      taskCode: payload.taskId,
      deadline: payload.deadline,
    });
  }
}
