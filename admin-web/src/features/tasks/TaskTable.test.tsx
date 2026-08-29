import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/types";
import { TaskTable } from "./TaskTable";

/** Ngày "hôm nay" cố định để nhãn hạn xử lý luôn xác định */
const TODAY = new Date(2026, 0, 15, 9, 30, 0);

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "NV-001",
    title: "Rà soát hồ sơ đất đai thôn Đông",
    sourceLabel: "VB 128/UBND",
    sourceType: "vb",
    assignee: "Lê Minh Tuấn",
    department: "Địa chính – Xây dựng",
    deadline: "20/01/2026",
    progress: 40,
    status: "dang",
    priority: "cao",
    assigner: "Nguyễn Văn Bình",
    collaborators: [],
    description: "",
    checklist: [],
    ...overrides,
  };
}

/** Hàng dữ liệu của bảng (bỏ hàng tiêu đề) */
function bodyRows(): HTMLElement[] {
  return screen.getAllByRole("row").slice(1);
}

describe("TaskTable", () => {
  beforeEach(() => {
    // Chỉ giả lập Date để không ảnh hưởng tới userEvent / React scheduler
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("render một hàng cho mỗi nhiệm vụ kèm các cột thông tin chính", () => {
    render(
      <TaskTable
        tasks={[makeTask(), makeTask({ id: "NV-002", title: "Giải quyết phản ánh rác thải", assignee: "Ngô Thị Lan" })]}
        onOpen={vi.fn()}
      />,
    );

    const rows = bodyRows();
    expect(rows).toHaveLength(2);

    const first = within(rows[0]);
    expect(first.getByText("NV-001")).toBeInTheDocument();
    expect(first.getByText("Rà soát hồ sơ đất đai thôn Đông")).toBeInTheDocument();
    expect(first.getByText("VB 128/UBND")).toBeInTheDocument();
    expect(first.getByText("Địa chính – Xây dựng")).toBeInTheDocument();
    expect(first.getByText("Lê Minh Tuấn")).toBeInTheDocument();
    expect(rows[0]).toHaveTextContent("40%");

    const second = within(rows[1]);
    expect(second.getByText("NV-002")).toBeInTheDocument();
    expect(second.getByText("Giải quyết phản ánh rác thải")).toBeInTheDocument();
    expect(second.getByText("Ngô Thị Lan")).toBeInTheDocument();
  });

  it("hiển thị nhãn trạng thái và mức ưu tiên theo từ điển cấu hình", () => {
    render(<TaskTable tasks={[makeTask({ status: "cho", priority: "thap" })]} onOpen={vi.fn()} />);

    expect(screen.getByText("Chờ duyệt")).toBeInTheDocument();
    expect(screen.getByText("Thấp")).toBeInTheDocument();
  });

  it("tính số ngày còn lại từ hạn dạng dd/MM/yyyy", () => {
    render(<TaskTable tasks={[makeTask({ deadline: "20/01/2026" })]} onOpen={vi.fn()} />);

    // 15/01 -> 20/01 là 5 ngày, trên 3 ngày nên hiện màu xanh lá
    expect(screen.getByText("Còn 5 ngày")).toBeInTheDocument();
    expect(screen.getByText("Còn 5 ngày")).toHaveStyle({ color: "var(--green)" });
  });

  it("cảnh báo cam khi hạn còn tối đa 3 ngày", () => {
    render(<TaskTable tasks={[makeTask({ deadline: "17/01/2026" })]} onOpen={vi.fn()} />);

    const label = screen.getByText("Còn 2 ngày");
    expect(label).toBeInTheDocument();
    expect(label).toHaveStyle({ color: "var(--orange)" });
  });

  it("hiển thị 'Đến hạn hôm nay' khi hạn đúng ngày hôm nay", () => {
    render(<TaskTable tasks={[makeTask({ deadline: "15/01/2026" })]} onOpen={vi.fn()} />);

    expect(screen.getByText("Đến hạn hôm nay")).toBeInTheDocument();
  });

  it("hiển thị số ngày quá hạn và tô đỏ ngày hạn khi đã trễ", () => {
    render(<TaskTable tasks={[makeTask({ deadline: "10/01/2026" })]} onOpen={vi.fn()} />);

    expect(screen.getByText("Quá hạn 5 ngày")).toBeInTheDocument();
    // Ngày hạn được in đậm màu đỏ khi trễ
    expect(screen.getByText("10/01/2026")).toHaveStyle({ color: "var(--red)", fontWeight: "700" });
  });

  it("nhiệm vụ đã hoàn thành chỉ hiện 'Đã hoàn thành', không tính số ngày quá hạn", () => {
    render(<TaskTable tasks={[makeTask({ status: "xong", deadline: "01/01/2026" })]} onOpen={vi.fn()} />);

    expect(screen.getByText("Đã hoàn thành")).toBeInTheDocument();
    expect(screen.queryByText(/Quá hạn/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Còn /)).not.toBeInTheDocument();
    expect(screen.getByText("01/01/2026")).toBeInTheDocument();
  });

  it("coi hạn sai định dạng như đến hạn hôm nay thay vì crash", () => {
    render(<TaskTable tasks={[makeTask({ deadline: "chưa xác định" })]} onOpen={vi.fn()} />);

    expect(screen.getByText("Đến hạn hôm nay")).toBeInTheDocument();
    expect(screen.getByText("chưa xác định")).toBeInTheDocument();
  });

  it("gắn class 'late' cho hàng có trạng thái quá hạn", () => {
    render(
      <TaskTable
        tasks={[makeTask({ id: "NV-001", status: "qua", deadline: "10/01/2026" }), makeTask({ id: "NV-002", status: "dang" })]}
        onOpen={vi.fn()}
      />,
    );

    const [lateRow, normalRow] = bodyRows();
    expect(lateRow).toHaveClass("late");
    expect(within(lateRow).getByText("NV-001")).toBeInTheDocument();
    expect(normalRow).not.toHaveClass("late");
  });

  it("gọi onOpen kèm đúng mã nhiệm vụ khi bấm vào hàng", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onOpen = vi.fn();
    render(<TaskTable tasks={[makeTask({ id: "NV-001" }), makeTask({ id: "NV-002" })]} onOpen={onOpen} />);

    await user.click(bodyRows()[1]);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith("NV-002");
  });

  it("hiện thông báo rỗng trải hết bảng khi không có nhiệm vụ nào khớp bộ lọc", () => {
    const onOpen = vi.fn();
    render(<TaskTable tasks={[]} onOpen={onOpen} />);

    const emptyCell = screen.getByText("Không có nhiệm vụ phù hợp bộ lọc");
    expect(emptyCell).toBeInTheDocument();
    expect(emptyCell).toHaveAttribute("colspan", "8");
    expect(bodyRows()).toHaveLength(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("hiển thị viết tắt tên người thực hiện trên avatar", () => {
    render(<TaskTable tasks={[makeTask({ assignee: "Lê Minh Tuấn" })]} onOpen={vi.fn()} />);

    expect(screen.getByTitle("Lê Minh Tuấn")).toHaveTextContent("LT");
  });
});
