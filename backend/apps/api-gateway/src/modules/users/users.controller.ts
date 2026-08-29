import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { RequirePermission, type AuthedRequest } from '@vigov/shared';
import { UsersService } from './users.service';
import {
  ChangeStaffPasswordDto,
  CreateBlacklistDto,
  CreateStaffDto,
  ListBlacklistQueryDto,
  ListCitizensQueryDto,
  ListSessionsQueryDto,
  LockCitizenDto,
  RevokeOtherSessionsQueryDto,
  UpdateStaffDto,
} from './dto/users.dto';

/** Tên tài khoản của người đang đăng nhập (dùng làm `by` của bản ghi chặn) */
function actorOf(req: AuthedRequest): string {
  return req.user?.username ?? 'system';
}

/**
 * Phân hệ Người dùng & bảo mật (WBS #11, P3-31).
 * Toàn bộ endpoint đều yêu cầu đăng nhập (JwtAuthGuard toàn cục ở app.module).
 */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // ─── Công dân ────────────────────────────────────────────────────────────

  /** Danh sách công dân — số điện thoại luôn trả ra ở dạng che "098•••321" */
  @Get('citizens')
  @RequirePermission('users', 'view')
  listCitizens(@Query() query: ListCitizensQueryDto) {
    return this.users.listCitizens(query);
  }

  /**
   * Thống kê nhanh công dân cho các thẻ đầu trang.
   * Khai báo TRƯỚC route ':phone' để không bị tham số động nuốt mất.
   */
  @Get('citizens/stats')
  @RequirePermission('users', 'view')
  citizenStats() {
    return this.users.citizenStats();
  }

  /**
   * Chi tiết công dân theo `id` (_id dạng chuỗi) — cách tra CHÍNH cho Web Quản trị.
   * Danh sách chỉ trả SĐT đã che ("098•••321") nên không thể tra ngược theo SĐT thật;
   * các route theo ':phone' bên dưới giữ lại cho client cũ (app/tích hợp nội bộ).
   */
  @Get('citizens/id/:id')
  @RequirePermission('users', 'view')
  getCitizenById(@Param('id') id: string) {
    return this.users.getCitizenById(id);
  }

  /** Khoá tài khoản công dân theo `id` */
  @Patch('citizens/id/:id/lock')
  @RequirePermission('users', 'edit')
  lockCitizenById(@Param('id') id: string, @Body() dto: LockCitizenDto, @Req() req: AuthedRequest) {
    return this.users.lockCitizenById(id, dto.reason, actorOf(req));
  }

  /** Mở khoá tài khoản công dân theo `id` */
  @Patch('citizens/id/:id/unlock')
  @RequirePermission('users', 'edit')
  unlockCitizenById(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.users.unlockCitizenById(id, actorOf(req));
  }

  /** Chi tiết công dân theo số điện thoại (tương thích ngược) */
  @Get('citizens/:phone')
  @RequirePermission('users', 'view')
  getCitizen(@Param('phone') phone: string) {
    return this.users.getCitizen(phone);
  }

  /**
   * Khoá tài khoản công dân — bắt buộc nêu lý do.
   * Quyền khoá/mở hiện đặt ở mức `users:edit` (tiếp nhận một cửa cũng làm được);
   * nếu khách muốn chỉ lãnh đạo/quản trị được khoá thì đổi thành 'admin'
   * (câu hỏi mở #15 — chờ khách xác nhận).
   */
  @Patch('citizens/:phone/lock')
  @RequirePermission('users', 'edit')
  lockCitizen(@Param('phone') phone: string, @Body() dto: LockCitizenDto, @Req() req: AuthedRequest) {
    return this.users.lockCitizen(phone, dto.reason, actorOf(req));
  }

  /** Mở khoá công dân + gỡ hiệu lực các bản ghi chặn tương ứng */
  @Patch('citizens/:phone/unlock')
  @RequirePermission('users', 'edit')
  unlockCitizen(@Param('phone') phone: string, @Req() req: AuthedRequest) {
    return this.users.unlockCitizen(phone, actorOf(req));
  }

  // ─── Phiên đăng nhập ─────────────────────────────────────────────────────

  /** Danh sách phiên đang hoạt động theo kênh web/app/zalo (kèm cờ `current`) */
  @Get('sessions')
  @RequirePermission('users', 'view')
  listSessions(@Query() query: ListSessionsQueryDto, @Req() req: AuthedRequest) {
    return this.users.listSessions(query, actorOf(req));
  }

  /**
   * Thu hồi mọi phiên khác của CHÍNH người đang đăng nhập.
   * Khai báo trước route ':id' để không bị nuốt bởi tham số động.
   */
  @Delete('sessions/revoke-others')
  @RequirePermission('users', 'view')
  revokeOtherSessions(@Query() query: RevokeOtherSessionsQueryDto, @Req() req: AuthedRequest) {
    return this.users.revokeOtherSessions(actorOf(req), query.except);
  }

  /** Thu hồi một phiên đăng nhập cụ thể */
  @Delete('sessions/:id')
  @RequirePermission('users', 'edit')
  revokeSession(@Param('id') id: string) {
    return this.users.revokeSession(id);
  }

  // ─── Danh sách chặn ──────────────────────────────────────────────────────

  /**
   * Danh sách chặn. Ai được xem danh sách này (chỉ quản trị hay cả tiếp nhận
   * một cửa) đang chờ khách xác nhận — câu hỏi mở #15.
   */
  @Get('blacklist')
  @RequirePermission('users', 'view')
  listBlacklist(@Query() query: ListBlacklistQueryDto) {
    return this.users.listBlacklist(query);
  }

  /** Thêm bản ghi chặn công dân / thiết bị / IP */
  @Post('blacklist')
  @RequirePermission('users', 'edit')
  createBlacklist(@Body() dto: CreateBlacklistDto, @Req() req: AuthedRequest) {
    return this.users.createBlacklist(dto, actorOf(req));
  }

  /** Gỡ hiệu lực một bản ghi chặn */
  @Patch('blacklist/:id/deactivate')
  @RequirePermission('users', 'edit')
  deactivateBlacklist(@Param('id') id: string) {
    return this.users.deactivateBlacklist(id);
  }

  // ─── Cán bộ (phục vụ trang Cấu hình) ─────────────────────────────────────

  /** Danh sách tài khoản cán bộ — không bao giờ kèm passwordHash */
  @Get('staff')
  @RequirePermission('users', 'view')
  listStaff() {
    return this.users.listStaff();
  }

  /** Tạo tài khoản cán bộ; mật khẩu tạm trả về MỘT LẦN duy nhất trong phản hồi này */
  @Post('staff')
  @RequirePermission('users', 'admin')
  createStaff(@Body() dto: CreateStaffDto) {
    return this.users.createStaff(dto);
  }

  /** Đổi vai trò / đơn vị / trạng thái tài khoản cán bộ */
  @Patch('staff/:username')
  @RequirePermission('users', 'admin')
  updateStaff(@Param('username') username: string, @Body() dto: UpdateStaffDto) {
    return this.users.updateStaff(username, dto);
  }

  /**
   * Xoá tài khoản cán bộ (dọn tài khoản kiểm thử / cán bộ nghỉ việc).
   * Service chặn tự xoá chính mình và chặn xoá quản trị viên hoạt động cuối cùng.
   */
  @Delete('staff/:username')
  @RequirePermission('users', 'admin')
  deleteStaff(@Param('username') username: string, @Req() req: AuthedRequest) {
    return this.users.deleteStaff(username, actorOf(req));
  }

  /** Đặt lại mật khẩu tài khoản cán bộ */
  @Patch('staff/:username/password')
  @RequirePermission('users', 'admin')
  changeStaffPassword(@Param('username') username: string, @Body() dto: ChangeStaffPasswordDto) {
    return this.users.changeStaffPassword(username, dto);
  }
}
