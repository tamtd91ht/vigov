import { Transform, Type } from 'class-transformer';
import { SoftDeleteBodyDto } from '@vigov/shared';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { IsStrongPassword, ROLES } from '@vigov/shared';

/** Giới hạn phân trang dùng chung cho các endpoint danh sách của phân hệ Người dùng */
export const MAX_PAGE_SIZE = 100;
/*
 * Độ dài và độ mạnh mật khẩu KHÔNG khai ở đây nữa: chính sách nằm ở
 * `libs/shared/src/auth/password-policy.ts` để đường tạo tài khoản, đường quản
 * trị viên đặt lại và đường người dùng tự đổi không thể lệch nhau.
 */

/** Danh sách khoá vai trò hợp lệ — lấy trực tiếp từ ROLES của libs/shared */
const ROLE_KEYS = ROLES.map((r) => r.key);

/** Tham số phân trang chung */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang phải là số nguyên' })
  @Min(1, { message: 'Số trang phải lớn hơn 0' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số bản ghi mỗi trang phải là số nguyên' })
  @Min(1, { message: 'Số bản ghi mỗi trang phải lớn hơn 0' })
  @Max(MAX_PAGE_SIZE, { message: `Số bản ghi mỗi trang tối đa ${MAX_PAGE_SIZE}` })
  limit?: number;
}

/** Lọc danh sách công dân: q khớp số điện thoại hoặc họ tên */
export class ListCitizensQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString({ message: 'Từ khoá tìm kiếm không hợp lệ' })
  q?: string;

  @IsOptional()
  @IsString({ message: 'Khu vực không hợp lệ' })
  area?: string;

  @IsOptional()
  @IsIn(['active', 'locked'], { message: 'Trạng thái chỉ nhận: active, locked' })
  status?: string;

  /**
   * `true` thì CHỈ trả tài khoản đã xoá mềm (bộ lọc "Đã xoá" của Web Quản trị);
   * không truyền thì danh sách chỉ có tài khoản chưa xoá.
   *
   * Lớp này đã `extends PaginationQueryDto` nên không kế thừa thêm
   * `SoftDeleteQueryDto` được (TS không đa kế thừa). Bộ decorator dưới đây phải
   * giữ Y NGUYÊN như `SoftDeleteQueryDto.deleted` để API không lệch kiểu giữa
   * các phân hệ — sửa một bên thì sửa cả hai.
   */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsBoolean({ message: 'Tham số deleted phải là true hoặc false' })
  deleted?: boolean;
}

/** Khoá tài khoản công dân — bắt buộc nêu lý do để lưu vết */
export class LockCitizenDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do khoá tài khoản' })
  reason: string;
}

/** Xoá mềm tài khoản công dân — lý do không bắt buộc, có thì lưu để truy vết */
export class DeleteCitizenDto extends SoftDeleteBodyDto {}

/** Lọc danh sách phiên đăng nhập theo kênh */
export class ListSessionsQueryDto {
  @IsOptional()
  @IsIn(['web', 'app', 'zalo'], { message: 'Kênh đăng nhập chỉ nhận: web, app, zalo' })
  kind?: string;
}

/** Thu hồi các phiên khác của chính người đang đăng nhập */
export class RevokeOtherSessionsQueryDto {
  /** Id phiên hiện tại được giữ lại (nếu client biết) */
  @IsOptional()
  @IsString({ message: 'Mã phiên cần giữ lại không hợp lệ' })
  except?: string;
}

/** Lọc danh sách chặn */
export class ListBlacklistQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'Tham số active chỉ nhận: true, false' })
  active?: string;

  @IsOptional()
  @IsIn(['citizen', 'device', 'ip'], { message: 'Loại chặn chỉ nhận: citizen, device, ip' })
  kind?: string;
}

/** Thêm bản ghi chặn (công dân / thiết bị / IP) */
export class CreateBlacklistDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập đối tượng cần chặn' })
  subject: string;

  @IsIn(['citizen', 'device', 'ip'], { message: 'Loại chặn chỉ nhận: citizen, device, ip' })
  kind: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do chặn' })
  reason: string;
}

/** Tạo tài khoản cán bộ — mật khẩu tạm do hệ thống sinh */
export class CreateStaffDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên đăng nhập' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên hiển thị' })
  displayName: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập đơn vị công tác' })
  department: string;

  @IsIn(ROLE_KEYS, { message: `Vai trò chỉ nhận: ${ROLE_KEYS.join(', ')}` })
  roleKey: string;
}

/** Cập nhật vai trò / đơn vị / trạng thái tài khoản cán bộ */
export class UpdateStaffDto {
  @IsOptional()
  @IsIn(ROLE_KEYS, { message: `Vai trò chỉ nhận: ${ROLE_KEYS.join(', ')}` })
  roleKey?: string;

  @IsOptional()
  @IsString({ message: 'Đơn vị công tác không hợp lệ' })
  @IsNotEmpty({ message: 'Đơn vị công tác không được để trống' })
  department?: string;

  @IsOptional()
  @IsIn(['active', 'locked'], { message: 'Trạng thái chỉ nhận: active, locked' })
  status?: string;
}

/** Đặt lại mật khẩu cán bộ */
export class ChangeStaffPasswordDto {
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}
