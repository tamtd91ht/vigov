import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { RequirePermission, type AuthedRequest, type JwtPayload } from '@vigov/shared';
import {
  AssignFeedbackDto,
  CreateCitizenFeedbackDto,
  CreateStaffFeedbackDto,
  DecideWithdrawDto,
  ListFeedbackQueryDto,
  RateFeedbackDto,
  ResolveFeedbackDto,
  TransferFeedbackDto,
  UpdateCitizenFeedbackDto,
  WithdrawFeedbackDto,
} from './dto/feedback.dto';
import { FeedbackService } from './feedback.service';

/** Vai trò của tài khoản công dân (Zalo Mini App) */
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

  /**
   * Cán bộ lập phiếu hộ người dân đến trình bày TRỰC TIẾP tại xã (WBS #6).
   *
   * Khai báo TRƯỚC nhóm /citizen và các route ':code' — POST '' không đụng
   * route động, nhưng giữ cùng khối với nghiệp vụ cán bộ cho dễ đọc.
   * Quyền `feedback:edit`: đúng mức đang dùng cho phân công / xử lý phiếu,
   * và vai trò "Tiếp nhận một cửa" đã có sẵn mức này.
   */
  @RequirePermission('feedback', 'edit')
  @Post()
  createByStaff(@Body() dto: CreateStaffFeedbackDto, @Req() req: AuthedRequest) {
    return this.feedback.createByStaff(dto, actorOf(req));
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

  /** Công dân sửa tiêu đề / nội dung — chỉ khi chưa có cán bộ tiếp nhận */
  @Patch('citizen/mine/:code')
  updateMine(
    @Param('code') code: string,
    @Body() dto: UpdateCitizenFeedbackDto,
    @Req() req: AuthedRequest,
  ) {
    return this.feedback.updateMine(code, citizenOf(req).username, dto);
  }

  /**
   * Công dân xin thu hồi phiếu của chính mình.
   *
   * Chưa ai tiếp nhận thì gỡ ngay (`removed: true`); đã có người tiếp nhận thì
   * chuyển sang chờ cán bộ xác nhận (`removed: false`, `withdrawStatus: 'pending'`).
   */
  @Post('citizen/mine/:code/withdraw')
  withdrawMine(
    @Param('code') code: string,
    @Body() dto: WithdrawFeedbackDto,
    @Req() req: AuthedRequest,
  ) {
    return this.feedback.requestWithdraw(code, citizenOf(req).username, dto);
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

  // --- Cán bộ: quyết định yêu cầu thu hồi của công dân -----------------------
  //
  // Dùng quyền 'approve' chứ KHÔNG phải 'edit': gỡ một phiếu phản ánh khỏi hàng
  // đợi là quyết định về một tài liệu hành chính, không phải thao tác xử lý
  // thường ngày. Theo bảng vai trò hiện hành thì chỉ 'leader' và 'admin' được
  // quyết — chuyên viên đang xử lý phiếu không tự đóng phiếu của mình được.

  /** Đồng ý cho công dân thu hồi — phiếu được gỡ (xoá mềm) */
  @RequirePermission('feedback', 'approve')
  @Patch(':code/withdraw/approve')
  approveWithdraw(
    @Param('code') code: string,
    @Body() dto: DecideWithdrawDto,
    @Req() req: AuthedRequest,
  ) {
    return this.feedback.approveWithdraw(code, dto, actorOf(req));
  }

  /**
   * Từ chối yêu cầu thu hồi — phiếu quay lại xử lý bình thường.
   *
   * Lý do BẮT BUỘC: người dân đọc được lý do này trên Mini App. Không có nó thì
   * yêu cầu của họ chỉ im lặng biến mất và họ sẽ gửi lại.
   */
  @RequirePermission('feedback', 'approve')
  @Patch(':code/withdraw/reject')
  rejectWithdraw(
    @Param('code') code: string,
    @Body() dto: DecideWithdrawDto,
    @Req() req: AuthedRequest,
  ) {
    if (!dto.note?.trim()) {
      throw new BadRequestException('Vui lòng nêu lý do từ chối để người dân được biết');
    }
    return this.feedback.rejectWithdraw(code, dto, actorOf(req));
  }
}
