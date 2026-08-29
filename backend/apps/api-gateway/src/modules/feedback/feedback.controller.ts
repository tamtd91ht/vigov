import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { RequirePermission, type AuthedRequest, type JwtPayload } from '@vigov/shared';
import {
  AssignFeedbackDto,
  CreateCitizenFeedbackDto,
  ListFeedbackQueryDto,
  RateFeedbackDto,
  ResolveFeedbackDto,
  TransferFeedbackDto,
} from './dto/feedback.dto';
import { FeedbackService } from './feedback.service';

/** Vai trò của tài khoản công dân (app Flutter / Zalo Mini App) */
const CITIZEN_ROLE_KEY = 'citizen';

/**
 * Xác nhận người gọi là công dân.
 * Nhóm endpoint /feedback/citizen/** KHÔNG dùng @RequirePermission (bảng RBAC
 * chỉ mô tả vai trò cán bộ) mà tự kiểm tra roleKey rồi lọc dữ liệu theo
 * req.user.username — với tài khoản công dân username chính là số điện thoại.
 */
function citizenOf(req: AuthedRequest): JwtPayload {
  const user = req.user;
  if (!user || user.roleKey !== CITIZEN_ROLE_KEY) {
    throw new ForbiddenException('Chức năng này chỉ dành cho tài khoản công dân');
  }
  return user;
}

/** Tên cán bộ đang thao tác để ghi vào timeline */
function actorOf(req: AuthedRequest): string {
  return req.user?.displayName || req.user?.username || 'Hệ thống';
}

/** Phản ánh người dân (WBS #6 — Web Quản trị, WBS #13 — app công dân) */
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  // --- Cán bộ: tra cứu ------------------------------------------------------

  /** Danh sách phản ánh có lọc + phân trang, kèm slaHoursLeft (âm = quá hạn) */
  @RequirePermission('feedback', 'view')
  @Get()
  list(@Query() query: ListFeedbackQueryDto) {
    return this.feedback.list(query);
  }

  /** 4 thẻ thống kê đầu trang Phản ánh */
  @RequirePermission('feedback', 'view')
  @Get('stats')
  stats() {
    return this.feedback.stats();
  }

  // --- Công dân -------------------------------------------------------------
  // Khai báo TRƯỚC các route ':code' để không bị route động nuốt mất.

  /** Công dân gửi phản ánh mới */
  @Post('citizen')
  create(@Body() dto: CreateCitizenFeedbackDto, @Req() req: AuthedRequest) {
    const user = citizenOf(req);
    return this.feedback.createByCitizen(dto, user.username, user.displayName);
  }

  /** Danh sách phản ánh của chính công dân đang đăng nhập */
  @Get('citizen/mine')
  listMine(@Query() query: ListFeedbackQueryDto, @Req() req: AuthedRequest) {
    return this.feedback.listMine(citizenOf(req).username, query);
  }

  /** Chi tiết một phiếu của chính công dân */
  @Get('citizen/mine/:code')
  detailMine(@Param('code') code: string, @Req() req: AuthedRequest) {
    return this.feedback.detailMine(code, citizenOf(req).username);
  }

  /** Đánh giá mức độ hài lòng 1–5 sao sau khi phiếu đã xử lý xong */
  @Post('citizen/mine/:code/rating')
  rateMine(@Param('code') code: string, @Body() dto: RateFeedbackDto, @Req() req: AuthedRequest) {
    return this.feedback.rateMine(code, citizenOf(req).username, dto);
  }

  // --- Cán bộ: chi tiết & xử lý ---------------------------------------------

  /** Chi tiết phiếu phản ánh */
  @RequirePermission('feedback', 'view')
  @Get(':code')
  detail(@Param('code') code: string) {
    return this.feedback.detail(code);
  }

  /** Phân công cán bộ + bộ phận chủ trì */
  @RequirePermission('feedback', 'edit')
  @Patch(':code/assign')
  assign(@Param('code') code: string, @Body() dto: AssignFeedbackDto, @Req() req: AuthedRequest) {
    return this.feedback.assign(code, dto, actorOf(req));
  }

  /** Xác nhận đã xử lý xong và gửi kết quả cho công dân */
  @RequirePermission('feedback', 'edit')
  @Patch(':code/resolve')
  resolve(@Param('code') code: string, @Body() dto: ResolveFeedbackDto, @Req() req: AuthedRequest) {
    return this.feedback.resolve(code, dto, actorOf(req));
  }

  /** Chuyển phản ánh sang bộ phận khác */
  @RequirePermission('feedback', 'edit')
  @Patch(':code/transfer')
  transfer(@Param('code') code: string, @Body() dto: TransferFeedbackDto, @Req() req: AuthedRequest) {
    return this.feedback.transfer(code, dto, actorOf(req));
  }
}
