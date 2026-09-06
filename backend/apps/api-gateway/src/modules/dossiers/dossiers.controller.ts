import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@vigov/shared';
import { DossiersService } from './dossiers.service';

/**
 * Hạn mức riêng cho tra cứu hồ sơ công khai.
 *
 * Endpoint không cần đăng nhập và mã hồ sơ có dạng đoán được
 * (HS-<năm>-<số thứ tự>), nên hạn mức chung 120 lượt/phút là đủ rộng để quét
 * cạn dải số trong ít phút — mà mỗi kết quả đều mang tên người nộp hồ sơ. 20
 * lượt/phút mỗi IP vẫn thừa cho người dân tra vài mã, kể cả khi gõ sai vài lần.
 */
const LOOKUP_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

/** Tra cứu hồ sơ một cửa (WBS #15) */
@Controller('dossiers')
export class DossiersController {
  constructor(private readonly dossiers: DossiersService) {}

  /**
   * Tra cứu tiến độ hồ sơ theo mã.
   *
   * `@Public()`: công dân tra cứu bằng mã trên giấy tiếp nhận, KHÔNG bắt đăng
   * nhập — đây là yêu cầu nghiệp vụ của WBS #15. Đổi lại, phản hồi không mang
   * thông tin nào ngoài phạm vi giấy hẹn và số điện thoại luôn ở dạng che.
   */
  @Public()
  @Throttle(LOOKUP_THROTTLE)
  @Get('lookup/:code')
  lookup(@Param('code') code: string) {
    return this.dossiers.lookup(code);
  }
}
