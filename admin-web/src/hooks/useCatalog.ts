"use client";

import { useApiResource } from "./useApiResource";

/**
 * Tải một danh mục dùng chung (bộ phận, danh bạ cán bộ, thôn/tổ dân phố,
 * chuyên mục CMS, năm ngân sách…) từ `services/catalogs.service`.
 *
 * Danh mục chỉ dùng để đổ dropdown / chip lọc nên lỗi hay đang tải đều trả
 * mảng rỗng — dropdown tạm trống thay vì chặn cả trang bằng màn hình lỗi.
 * Phần dữ liệu nghiệp vụ chính vẫn được bọc <DataState> như thường.
 */
export function useCatalog<T>(fetcher: () => Promise<T[]>): T[] {
  const resource = useApiResource<T[]>(fetcher, []);
  return resource.data ?? [];
}
