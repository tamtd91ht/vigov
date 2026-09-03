import type { Readable } from 'node:stream';

/**
 * Hợp đồng driver lưu trữ tệp (WBS #24 — task P3-24).
 *
 * Mọi backend lưu trữ (đĩa cục bộ, S3/MinIO...) đều bọc lại theo interface này
 * để FilesService không phụ thuộc hạ tầng cụ thể. Chọn driver theo cấu hình
 * `storage.driver` đọc qua ConfigService.
 */

/**
 * Khoá tệp hợp lệ: các đoạn ngăn bằng "/" chỉ gồm chữ, số, gạch ngang, gạch dưới
 * và kết thúc bằng phần mở rộng — ví dụ `feedback/2026/08/<uuid>.jpg`.
 * Regex này CHẶN ".." và ký tự đường dẫn tuyệt đối nên là lớp phòng vệ đầu tiên
 * chống path traversal trước khi ghép vào thư mục gốc.
 */
export const SAFE_STORAGE_KEY_PATTERN = /^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.[A-Za-z0-9]{1,10}$/;

/** Thư mục lưu trữ mặc định khi chưa cấu hình STORAGE_LOCAL_DIR */
export const DEFAULT_LOCAL_DIR = './uploads';

/** Tên driver được hỗ trợ ở Phase 1 */
export const STORAGE_DRIVERS = ['local', 's3'] as const;
export type StorageDriverName = (typeof STORAGE_DRIVERS)[number];

/**
 * Khoảng byte của một yêu cầu Range, tính CẢ HAI ĐẦU theo đúng RFC 9110:
 * `bytes=0-1023` là 1024 byte đầu, tức start=0, end=1023.
 */
export interface ByteRange {
  start: number;
  end: number;
}

export interface StorageDriver {
  /** Ghi nội dung tệp vào kho lưu trữ theo khoá `key` */
  save(buffer: Buffer, key: string, mimeType: string): Promise<void>;
  /** Đọc nội dung tệp theo khoá */
  read(key: string): Promise<Buffer>;
  /**
   * Kích thước tệp (byte) đọc thẳng từ kho lưu trữ.
   *
   * Bản ghi Mongo cũng có trường `size`, nhưng phản hồi Range phải khớp CHÍNH
   * XÁC tệp đang nằm trên ổ: lệch một byte là trình phát cắt hụt khung hình
   * cuối hoặc treo khi tua. Nên lấy số thật, không tin bản ghi.
   */
  size(key: string): Promise<number>;
  /**
   * Luồng đọc tệp; có `range` thì chỉ đọc đúng khoảng đó.
   *
   * Trả luồng thay vì Buffer để phục vụ video: nạp cả tệp vào RAM rồi mới gửi
   * làm bộ nhớ tăng theo số người xem đồng thời, và chặn hẳn khả năng tua.
   */
  createReadStream(key: string, range?: ByteRange): Readable;
  /** Xoá tệp vật lý theo khoá (không có tệp thì coi như đã xoá) */
  delete(key: string): Promise<void>;
}
