/**
 * Bộ giả lập Model Mongoose dùng cho UNIT TEST (P5-07).
 *
 * Unit test không được mở kết nối cơ sở dữ liệu; các service lại gọi model theo
 * kiểu chuỗi (`find().sort().lean().exec()`), nên ở đây dựng sẵn một đối tượng
 * chuỗi trả về chính nó ở mọi bước trung gian và trả kết quả đã định ở `exec()`.
 */

/** Các bước trung gian của truy vấn Mongoose mà mã nguồn đang dùng */
const CHAINABLE = ['sort', 'select', 'lean', 'skip', 'limit', 'populate'] as const;

export interface QueryChain<T> {
  exec: jest.Mock<Promise<T>, []>;
  sort: jest.Mock;
  select: jest.Mock;
  lean: jest.Mock;
  skip: jest.Mock;
  limit: jest.Mock;
  populate: jest.Mock;
}

/**
 * Tạo một truy vấn giả: mọi bước trung gian trả về chính nó, `exec()` trả [result].
 * Truyền hàm để tính kết quả tại thời điểm gọi (ví dụ đọc trạng thái vừa thay đổi).
 */
export function queryChain<T>(result: T | (() => T)): QueryChain<T> {
  const chain = {} as QueryChain<T>;
  for (const step of CHAINABLE) {
    chain[step] = jest.fn(() => chain);
  }
  chain.exec = jest.fn(async () => (typeof result === 'function' ? (result as () => T)() : result));
  return chain;
}

/** Lỗi trùng khoá của MongoDB (code 11000) để kiểm thử nhánh sinh lại mã */
export function duplicateKeyError(message = 'E11000 duplicate key error'): Error & { code: number } {
  const err = new Error(message) as Error & { code: number };
  err.code = 11000;
  return err;
}

/**
 * Tạo tài liệu Mongoose giả: giữ nguyên các trường nghiệp vụ, bổ sung
 * `save()`, `markModified()`, `toObject()` mà service gọi tới.
 */
export function fakeDoc<T extends Record<string, unknown>>(
  fields: T,
): T & {
  save: jest.Mock;
  markModified: jest.Mock;
  toObject: jest.Mock;
} {
  const doc = {
    ...fields,
    save: jest.fn(async () => doc),
    markModified: jest.fn(),
    toObject: jest.fn(() => {
      const { save, markModified, toObject, ...rest } = doc as Record<string, unknown>;
      return rest;
    }),
  } as T & { save: jest.Mock; markModified: jest.Mock; toObject: jest.Mock };
  return doc;
}

/**
 * `DirectoryService` giả — trả danh bạ rỗng.
 *
 * Mọi service nghiệp vụ của v2 nhận service này qua constructor để quy đổi id
 * thành tên hiển thị. Phần lớn test không kiểm tên hiển thị, nên bản giả trả
 * danh bạ rỗng: `DirectoryLookup` khi đó tự trả tham chiếu "tên cũ" thay vì ném
 * lỗi, đúng như khi gặp cán bộ đã nghỉ việc trên hệ thống thật.
 *
 * Test nào CẦN kiểm tên hiển thị thì truyền sẵn hai bảng tra vào đây.
 */
export function directoryMock(
  staff: Record<string, { id: string; displayName: string }> = {},
  departments: Record<string, { id: string; displayName: string }> = {},
) {
  const lookup = {
    staffRef: (id?: string, legacyName?: string) =>
      id ? (staff[id] ?? { id: '', displayName: legacyName ?? 'Không xác định', legacy: true }) : null,
    departmentRef: (id?: string, legacyName?: string) =>
      id
        ? (departments[id] ?? { id: '', displayName: legacyName ?? 'Không xác định', legacy: true })
        : null,
    staffRefs: (ids?: string[]) =>
      (ids ?? []).map((id) => staff[id] ?? { id: '', displayName: 'Không xác định', legacy: true }),
  };
  return {
    /** Bộ tra cứu đồng bộ, cho test gọi thẳng các hàm nhận `DirectoryLookup` */
    lookupSync: lookup,
    lookup: jest.fn(async () => lookup),
    staffById: jest.fn(async () => new Map(Object.entries(staff))),
    departmentById: jest.fn(async () => new Map(Object.entries(departments))),
    staffOptions: jest.fn(async () => Object.values(staff)),
    departmentOptions: jest.fn(async () => Object.values(departments)),
    invalidate: jest.fn(),
  };
}
