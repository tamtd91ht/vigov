import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { RequirePermission, type AuthedRequest } from '@vigov/shared';
import { BroadcastNotificationDto, ListBroadcastQueryDto, ListNotificationQueryDto } from './dto/notification.dto';
import { NotificationService } from './notification.service';

/** Lấy định danh người đang đăng nhập (username cán bộ hoặc SĐT công dân) */
function currentUser(req: AuthedRequest): string {
  const username = req.user?.username;
  if (!username) throw new ForbiddenException('Không xác định được người dùng');
  return username;
}

/** Thông báo in-app + gửi hàng loạt (WBS #23) */
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  /** Hộp thông báo của chính người đang đăng nhập */
  @Get()
  list(@Query() query: ListNotificationQueryDto, @Req() req: AuthedRequest) {
    return this.notifications.listInbox(currentUser(req), query.page, query.limit);
  }

  /**
   * Lịch sử các lượt gửi hàng loạt (màn hình Thông báo của Web Quản trị).
   * Chỉ đọc nên đặt ở mức 'cms' / 'view'; việc gửi vẫn cần 'cms' / 'edit'.
   */
  @Get('broadcasts')
  @RequirePermission('cms', 'view')
  listBroadcasts(@Query() query: ListBroadcastQueryDto) {
    return this.notifications.listBroadcasts(query.audience, query.page, query.limit);
  }

  /** Đánh dấu đã đọc */
  @Patch(':id/read')
  markRead(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.notifications.markRead(id, currentUser(req));
  }

  /** Gửi thông báo hàng loạt tới công dân hoặc nội bộ cán bộ */
  @RequirePermission('cms', 'edit')
  @Post('broadcast')
  broadcast(@Body() dto: BroadcastNotificationDto, @Req() req: AuthedRequest) {
    return this.notifications.broadcast({ ...dto, actor: currentUser(req) });
  }
}
