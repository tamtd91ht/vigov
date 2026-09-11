/**
 * Quy ước tham chiếu giữa các bản ghi — nâng cấp v2.
 *
 * ## Luật: lưu id, hiển thị tên
 *
 * Cơ sở dữ liệu lưu **id**. Tên hiển thị được resolve ở tầng đọc rồi trả kèm
 * phản hồi. Đổi cách hiển thị không được làm đổi bản chất dữ liệu.
 *
 * v1 lưu **tên** ở 13 trường tham chiếu. Hai hậu quả:
 *
 * - Cán bộ đổi tên, hoặc bộ phận sáp nhập đổi tên, là mọi bản ghi cũ đứt liên
 *   kết — không truy được về tài khoản nào, phải đối soát tay.
 * - Backend không kiểm được người nhận việc có thật: `assignee` chỉ là chuỗi,
 *   nên gọi API trực tiếp giao được việc cho một người không tồn tại.
 *
 * ## Bảng đổi tên trường
 *
 * | v1 (tên) | v2 (id) | Trỏ tới |
 * |---|---|---|
 * | `assignee` | `assigneeId` | `staff_users._id` |
 * | `assigner` | `assignerId` | `staff_users._id` |
 * | `collaborators[]` | `collaboratorIds[]` | `staff_users._id` |
 * | `department` | `departmentId` | `org_nodes._id` |
 * | `deletedBy` | `deletedById` | `staff_users._id` |
 * | `signer` | `signerId` | `staff_users._id` |
 * | `authorName` | `authorId` | `staff_users._id` |
 *
 * Hậu tố `Id` / `Ids` là bắt buộc: nhìn tên trường phải biết ngay nó chứa id
 * chứ không chứa tên, vì cả hai đều là `string` nên kiểu không cảnh báo giúp.
 *
 * ## Giá trị rỗng
 *
 * Chuỗi rỗng `''` nghĩa là **hệ thống** hoặc **không xác định được**, dùng thay
 * `undefined` để mọi bản ghi có cùng bộ trường. Riêng dữ liệu di trú từ v1 mà
 * không tra được tài khoản thì giữ tên gốc ở trường `legacy*` (xem P7-04), để
 * không mất thông tin của hồ sơ cũ.
 */

/** Id một bản ghi trong Mongo, dạng chuỗi 24 ký tự hex */
export type ObjectIdString = string;

/**
 * Một tham chiếu đã resolve, dạng trả ra API.
 *
 * Phản hồi mang cả id và tên: id để client gửi lại khi sửa, tên để hiển thị.
 * Client **không** được suy tên từ id bằng cách tự gọi thêm API cho từng dòng —
 * đó là N+1 trên mọi danh sách.
 */
export interface ResolvedRef {
  id: ObjectIdString;
  displayName: string;
}

/** Tham chiếu tới một cán bộ, kèm phần trình bày mà client cần */
export interface StaffRef extends ResolvedRef {
  /** Chức danh, hiển thị cạnh tên trong ô chọn cán bộ */
  title?: string;
  /** Bộ phận đang công tác — để ô chọn cán bộ nhóm theo bộ phận */
  departmentId?: ObjectIdString;
}

/** Tham chiếu tới một bộ phận trong cây tổ chức */
export interface DepartmentRef extends ResolvedRef {
  parentId?: ObjectIdString;
}

/**
 * Tham chiếu không tra được — bản ghi di trú từ v1 mà tài khoản đã nghỉ việc
 * hoặc bộ phận đã giải thể.
 *
 * Trả về cho client dưới dạng này thay vì để trống, để cán bộ hiểu "đây là tên
 * cũ trong hồ sơ" chứ không phải "hệ thống mất dữ liệu".
 */
export interface LegacyRef {
  id: '';
  displayName: string;
  legacy: true;
}

/** Một tham chiếu trong phản hồi API: đã tra được, hoặc là tên cũ của hồ sơ */
export type RefOut = ResolvedRef | LegacyRef;

/** Dựng tham chiếu tên cũ cho bản ghi không tra được id */
export function legacyRef(displayName: string): LegacyRef {
  return { id: '', displayName, legacy: true };
}
