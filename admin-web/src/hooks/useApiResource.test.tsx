import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/services/api";
import { useApiResource } from "./useApiResource";

/** Promise điều khiển được từ bên ngoài — dùng để dựng tình huống phản hồi về trễ */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useApiResource", () => {
  it("bắt đầu ở trạng thái đang tải rồi trả dữ liệu khi thành công", async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: ["a", "b"] });
    const { result } = renderHook(() => useApiResource(fetcher));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ items: ["a", "b"] });
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("hiển thị thông báo của ApiError khi máy chủ trả lỗi", async () => {
    const fetcher = vi.fn().mockRejectedValue(new ApiError("Không có quyền truy cập", 403));
    const { result } = renderHook(() => useApiResource(fetcher));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Không có quyền truy cập");
    expect(result.current.data).toBeNull();
  });

  it("dùng thông báo mặc định khi lỗi không phải ApiError", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("boom"));
    const { result } = renderHook(() => useApiResource(fetcher));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Không tải được dữ liệu");
  });

  it("reload gọi lại API và cập nhật dữ liệu mới", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce("cũ").mockResolvedValueOnce("mới");
    const { result } = renderHook(() => useApiResource(fetcher));

    await waitFor(() => expect(result.current.data).toBe("cũ"));

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.data).toBe("mới"));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("reload xoá lỗi cũ khi lần gọi lại thành công", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new ApiError("Máy chủ lỗi", 500)).mockResolvedValueOnce("ok");
    const { result } = renderHook(() => useApiResource(fetcher));

    await waitFor(() => expect(result.current.error).toBe("Máy chủ lỗi"));

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.data).toBe("ok"));
    expect(result.current.error).toBeNull();
  });

  it("tự tải lại khi deps thay đổi", async () => {
    const fetcher = vi.fn((status: string) => Promise.resolve(`ket-qua:${status}`));
    const { result, rerender } = renderHook(({ status }: { status: string }) => useApiResource(() => fetcher(status), [status]), {
      initialProps: { status: "moi" },
    });

    await waitFor(() => expect(result.current.data).toBe("ket-qua:moi"));

    rerender({ status: "xong" });

    await waitFor(() => expect(result.current.data).toBe("ket-qua:xong"));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("bỏ qua phản hồi về trễ của lần gọi cũ (chống tranh chấp)", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useApiResource<string>(fetcher));
    expect(result.current.loading).toBe(true);

    // Gọi lại trong khi lần đầu vẫn treo -> lần đầu bị huỷ
    act(() => result.current.reload());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));

    // Lần thứ hai về trước
    await act(async () => {
      second.resolve("dữ liệu mới");
    });
    await waitFor(() => expect(result.current.data).toBe("dữ liệu mới"));
    expect(result.current.loading).toBe(false);

    // Lần đầu về sau — phải bị bỏ qua, không được ghi đè
    await act(async () => {
      first.resolve("dữ liệu cũ");
    });

    expect(result.current.data).toBe("dữ liệu mới");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("bỏ qua lỗi về trễ của lần gọi cũ", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useApiResource<string>(fetcher));
    act(() => result.current.reload());
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));

    await act(async () => {
      second.resolve("dữ liệu mới");
    });
    await waitFor(() => expect(result.current.data).toBe("dữ liệu mới"));

    await act(async () => {
      first.reject(new ApiError("Lỗi của lần gọi cũ", 500));
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe("dữ liệu mới");
  });

  it("setData cập nhật tại chỗ bằng giá trị hoặc hàm cập nhật", async () => {
    const fetcher = vi.fn(() => Promise.resolve(["a"]));
    const { result } = renderHook(() => useApiResource<string[]>(fetcher));

    await waitFor(() => expect(result.current.data).toEqual(["a"]));

    act(() => result.current.setData(["a", "b"]));
    expect(result.current.data).toEqual(["a", "b"]);

    act(() => result.current.setData((prev) => [...(prev ?? []), "c"]));
    expect(result.current.data).toEqual(["a", "b", "c"]);

    // Không gọi lại API khi chỉ cập nhật tại chỗ
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("không cập nhật state sau khi hook đã unmount", async () => {
    const first = deferred<string>();
    const fetcher = vi.fn().mockReturnValue(first.promise);
    const { result, unmount } = renderHook(() => useApiResource<string>(fetcher));

    unmount();
    await act(async () => {
      first.resolve("về sau khi đã huỷ");
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
  });
});
