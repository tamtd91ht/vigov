import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/services/api";

export interface ApiResource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Tải lại từ máy chủ */
  reload: () => void;
  /** Cập nhật dữ liệu tại chỗ sau thao tác ghi, khỏi phải gọi lại API */
  setData: (updater: T | ((prev: T | null) => T | null)) => void;
}

/**
 * Tải dữ liệu từ API kèm trạng thái đang tải / lỗi.
 * Port từ admin-web/src/hooks/useApiResource.ts để hai front-end dùng chung khuôn.
 *
 * `deps` là danh sách phụ thuộc (bộ lọc, trang…) — đổi thì tự tải lại.
 * Kết quả về trễ của lần gọi cũ bị bỏ qua bằng cờ `cancelled` trong hàm dọn dẹp
 * của effect, nên không ghi đè kết quả mới.
 */
export function useApiResource<T>(fetcher: () => Promise<T>, deps: unknown[] = []): ApiResource<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Đặt trạng thái tải trong tác vụ bất đồng bộ để không setState đồng bộ ngay trong effect
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetcher();
        if (!cancelled) setDataState(result);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Không tải được dữ liệu");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
    // `fetcher` được tạo mới mỗi lần render nên không đưa vào danh sách phụ thuộc;
    // màn hình truyền `deps` là các giá trị thật sự quyết định việc tải lại (bộ lọc, trang…).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const setData = useCallback((updater: T | ((prev: T | null) => T | null)) => {
    setDataState((prev) => (typeof updater === "function" ? (updater as (p: T | null) => T | null)(prev) : updater));
  }, []);

  return { data, loading, error, reload, setData };
}
