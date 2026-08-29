import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataState } from "./DataState";

describe("DataState", () => {
  it("hiện vòng quay khi đang tải và không render nội dung", () => {
    const { container } = render(
      <DataState loading error={null}>
        <p>Nội dung thật</p>
      </DataState>,
    );

    expect(screen.getByText("Đang tải dữ liệu…")).toBeInTheDocument();
    expect(container.querySelector(".spinner")).not.toBeNull();
    expect(screen.queryByText("Nội dung thật")).not.toBeInTheDocument();
  });

  it("hiện thông báo lỗi kèm nút thử lại và gọi handler khi bấm", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <DataState loading={false} error="Không kết nối được máy chủ" onRetry={onRetry}>
        <p>Nội dung thật</p>
      </DataState>,
    );

    expect(screen.getByText("Không kết nối được máy chủ")).toBeInTheDocument();
    expect(screen.queryByText("Nội dung thật")).not.toBeInTheDocument();

    const retry = screen.getByRole("button", { name: "Thử lại" });
    expect(retry).toHaveAttribute("type", "button");

    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("không hiện nút thử lại khi không truyền onRetry", () => {
    render(
      <DataState loading={false} error="Lỗi 500">
        <p>Nội dung thật</p>
      </DataState>,
    );

    expect(screen.getByText("Lỗi 500")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
  });

  it("ưu tiên trạng thái tải hơn trạng thái lỗi", () => {
    render(
      <DataState loading error="Lỗi cũ" onRetry={vi.fn()}>
        <p>Nội dung thật</p>
      </DataState>,
    );

    expect(screen.getByText("Đang tải dữ liệu…")).toBeInTheDocument();
    expect(screen.queryByText("Lỗi cũ")).not.toBeInTheDocument();
  });

  it("hiện thông báo rỗng mặc định khi tải xong nhưng không có dữ liệu", () => {
    render(
      <DataState loading={false} error={null} empty>
        <p>Nội dung thật</p>
      </DataState>,
    );

    expect(screen.getByText("Chưa có dữ liệu")).toBeInTheDocument();
    expect(screen.queryByText("Nội dung thật")).not.toBeInTheDocument();
  });

  it("cho phép tuỳ biến thông báo rỗng", () => {
    render(
      <DataState loading={false} error={null} empty emptyMessage="Không có nhiệm vụ nào">
        <p>Nội dung thật</p>
      </DataState>,
    );

    expect(screen.getByText("Không có nhiệm vụ nào")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có dữ liệu")).not.toBeInTheDocument();
  });

  it("ưu tiên trạng thái lỗi hơn trạng thái rỗng", () => {
    render(
      <DataState loading={false} error="Lỗi tải danh sách" empty emptyMessage="Không có nhiệm vụ nào">
        <p>Nội dung thật</p>
      </DataState>,
    );

    expect(screen.getByText("Lỗi tải danh sách")).toBeInTheDocument();
    expect(screen.queryByText("Không có nhiệm vụ nào")).not.toBeInTheDocument();
  });

  it("render nội dung khi tải xong, không lỗi và có dữ liệu", () => {
    const { container } = render(
      <DataState loading={false} error={null} empty={false}>
        <p>Nội dung thật</p>
      </DataState>,
    );

    expect(screen.getByText("Nội dung thật")).toBeInTheDocument();
    expect(container.querySelector(".empty")).toBeNull();
    expect(screen.queryByText("Đang tải dữ liệu…")).not.toBeInTheDocument();
  });

  it("render nội dung khi bỏ qua prop empty", () => {
    render(
      <DataState loading={false} error={null}>
        <p>Nội dung thật</p>
      </DataState>,
    );

    expect(screen.getByText("Nội dung thật")).toBeInTheDocument();
  });
});
