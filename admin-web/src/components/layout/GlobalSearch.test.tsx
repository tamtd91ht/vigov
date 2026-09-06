import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalSearch } from "./GlobalSearch";
import { emptySearchResponse, type SearchResponse } from "@/services/search.service";

/**
 * VÌ SAO TEST: bảng kết quả tìm kiếm là chỗ duy nhất nối ba phân hệ với nhau.
 * Hai điều dễ hỏng lặng lẽ khi sửa: gõ ít ký tự vẫn bắn truy vấn lên máy chủ,
 * và đường dẫn điều hướng mất tham số mã bản ghi — lúc đó bấm kết quả vẫn "chạy"
 * nhưng mở ra trang trắng không có ngăn chi tiết, rất khó phát hiện bằng mắt.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const globalSearch = vi.fn();
vi.mock("@/services/search.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/search.service")>();
  return { ...actual, globalSearch: (...args: unknown[]) => globalSearch(...args) };
});

function response(overrides: Partial<SearchResponse["results"]> = {}, q = "rác"): SearchResponse {
  const results = {
    tasks: [],
    documents: [],
    feedback: [],
    ...overrides,
  };
  return {
    q,
    types: ["tasks", "documents", "feedback"],
    results,
    total: results.tasks.length + results.documents.length + results.feedback.length,
  };
}

const FULL_RESULTS = {
  tasks: [{ code: "NV-2601", title: "Rà soát quỹ đất công ích", status: "dang", department: "Địa chính" }],
  documents: [
    { arrivalNo: "128", refNo: "128/UBND-VP", summary: "Đôn đốc thu gom rác thải", department: "Văn phòng" },
  ],
  feedback: [{ code: "PA-2608", title: "Rác thải tồn đọng", status: "received", categoryKey: "rac-thai" }],
};

describe("GlobalSearch", () => {
  beforeEach(() => {
    push.mockReset();
    globalSearch.mockReset();
    globalSearch.mockResolvedValue(emptySearchResponse("rác"));
  });

  it("từ khoá 1 ký tự không gọi máy chủ và có nhắc nhập thêm", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.type(screen.getByRole("searchbox"), "r");

    expect(await screen.findByText(/Nhập ít nhất 2 ký tự/)).toBeInTheDocument();
    expect(globalSearch).not.toHaveBeenCalled();
  });

  it("hiển thị đủ ba nhóm kết quả kèm nhãn tiếng Việt", async () => {
    globalSearch.mockResolvedValue(response(FULL_RESULTS));
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.type(screen.getByRole("searchbox"), "rác");

    expect(await screen.findByText("Nhiệm vụ")).toBeInTheDocument();
    expect(screen.getByText("Văn bản & Đơn thư")).toBeInTheDocument();
    expect(screen.getByText("Phản ánh người dân")).toBeInTheDocument();
    expect(screen.getByText("Rà soát quỹ đất công ích")).toBeInTheDocument();
    expect(screen.getByText("Đôn đốc thu gom rác thải")).toBeInTheDocument();
    expect(screen.getByText("Rác thải tồn đọng")).toBeInTheDocument();
    // Mã bản ghi hiện ở đầu dòng để cán bộ nhận ra ngay
    expect(screen.getByText("NV-2601")).toBeInTheDocument();
    expect(screen.getByText("Số đến 128")).toBeInTheDocument();
  });

  it("bấm kết quả thì điều hướng kèm mã bản ghi để mở sẵn ngăn chi tiết", async () => {
    globalSearch.mockResolvedValue(response(FULL_RESULTS));
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.type(screen.getByRole("searchbox"), "rác");
    await user.click(await screen.findByText("Rác thải tồn đọng"));

    expect(push).toHaveBeenCalledWith("/feedback?code=PA-2608");
  });

  it("mỗi loại kết quả điều hướng sang đúng phân hệ", async () => {
    globalSearch.mockResolvedValue(response(FULL_RESULTS));
    const user = userEvent.setup();
    render(<GlobalSearch />);

    const box = screen.getByRole("searchbox");
    await user.type(box, "rác");
    await user.click(await screen.findByText("Rà soát quỹ đất công ích"));
    expect(push).toHaveBeenCalledWith("/tasks?code=NV-2601");

    // Bấm một kết quả đóng bảng — bấm lại vào ô tìm kiếm để mở lại danh sách cũ
    await user.click(box);
    await user.click(await screen.findByText("Đôn đốc thu gom rác thải"));
    expect(push).toHaveBeenCalledWith("/documents?arrivalNo=128");
  });

  it("Enter mở kết quả đầu tiên khi chưa chọn dòng nào", async () => {
    globalSearch.mockResolvedValue(response(FULL_RESULTS));
    const user = userEvent.setup();
    render(<GlobalSearch />);

    const box = screen.getByRole("searchbox");
    await user.type(box, "rác");
    await screen.findByText("Rà soát quỹ đất công ích");
    await user.keyboard("{Enter}");

    expect(push).toHaveBeenCalledWith("/tasks?code=NV-2601");
  });

  it("phím mũi tên chọn dòng tiếp theo rồi Enter mở đúng dòng đó", async () => {
    globalSearch.mockResolvedValue(response(FULL_RESULTS));
    const user = userEvent.setup();
    render(<GlobalSearch />);

    const box = screen.getByRole("searchbox");
    await user.type(box, "rác");
    await screen.findByText("Rà soát quỹ đất công ích");
    // Dòng 0 là nhiệm vụ, dòng 1 là văn bản
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(push).toHaveBeenCalledWith("/documents?arrivalNo=128");
  });

  it("không có kết quả thì nói rõ, không để bảng trống", async () => {
    globalSearch.mockResolvedValue(response({}, "xyz"));
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.type(screen.getByRole("searchbox"), "xyz");

    expect(await screen.findByText(/Không tìm thấy kết quả/)).toBeInTheDocument();
  });

  it("máy chủ lỗi thì báo lỗi thay vì hiện kết quả cũ", async () => {
    globalSearch.mockRejectedValue(new Error("mất mạng"));
    const user = userEvent.setup();
    render(<GlobalSearch />);

    await user.type(screen.getByRole("searchbox"), "rác");

    expect(await screen.findByText("Không tìm kiếm được, vui lòng thử lại")).toBeInTheDocument();
  });

  it("phím Esc đóng bảng kết quả", async () => {
    globalSearch.mockResolvedValue(response(FULL_RESULTS));
    const user = userEvent.setup();
    render(<GlobalSearch />);

    const box = screen.getByRole("searchbox");
    await user.type(box, "rác");
    await screen.findByText("Rà soát quỹ đất công ích");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText("Rà soát quỹ đất công ích")).toBeNull());
  });
});
