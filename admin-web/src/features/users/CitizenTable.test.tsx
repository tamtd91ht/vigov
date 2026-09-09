import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CitizenAccount } from "@/services/users.service";
import { CitizenTable } from "./CitizenTable";

/** Danh mục thôn/tổ dân phố gọi API thật khi mount — chặn lại để test không chạm mạng */
vi.mock("@/services/catalogs.service", () => ({
  fetchCitizenAreas: () => Promise.resolve([]),
}));

/**
 * Xoá tài khoản công dân là thao tác XOÁ MỀM và chỉ quản trị viên được làm.
 *
 * VÌ SAO TEST: hai điều dễ hỏng lặng lẽ khi sửa bảng này — nút Xoá lọt ra với
 * vai trò không đủ quyền (bấm vào chỉ nhận 403, người dùng không hiểu vì sao),
 * và nút Xoá gọi thẳng API mà bỏ bước xác nhận.
 */

function makeCitizen(overrides: Partial<CitizenAccount> = {}): CitizenAccount {
  return {
    id: "CD-001",
    phone: "098•••432",
    displayName: "Thắng Nguyễn",
    area: "Thôn Đông",
    channel: "zalo",
    feedbackCount: 9,
    status: "active",
    ...overrides,
  };
}

function renderTable(props: Partial<React.ComponentProps<typeof CitizenTable>> = {}) {
  const onDelete = vi.fn();
  const onRestore = vi.fn();
  const onDeletedViewChange = vi.fn();

  render(
    <CitizenTable
      citizens={[makeCitizen()]}
      loading={false}
      error={null}
      onRetry={vi.fn()}
      total={1}
      page={1}
      limit={20}
      onPageChange={vi.fn()}
      search=""
      onSearchChange={vi.fn()}
      areaKey="all"
      onAreaChange={vi.fn()}
      busyId={null}
      onLock={vi.fn()}
      onUnlock={vi.fn()}
      deletedView={false}
      onDeletedViewChange={onDeletedViewChange}
      canDelete
      onDelete={onDelete}
      onRestore={onRestore}
      {...props}
    />,
  );

  return { onDelete, onRestore, onDeletedViewChange };
}

describe("CitizenTable — xoá mềm", () => {
  it("vai trò không có quyền admin thì không thấy nút Xoá lẫn bộ lọc Đã xoá", () => {
    renderTable({ canDelete: false });

    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Đã xoá" })).toBeNull();
    // Khoá/mở khoá vẫn là quyền users:edit nên phải còn nguyên
    expect(screen.getByRole("button", { name: /Khoá/ })).toBeTruthy();
  });

  it("bấm Xoá chỉ mở bước xác nhận, chưa gọi API", async () => {
    const user = userEvent.setup();
    const { onDelete } = renderTable();

    await user.click(screen.getByRole("button", { name: "Xoá" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Xác nhận xoá" })).toBeTruthy();
  });

  it("xác nhận thì gửi lên lý do đã cắt khoảng trắng", async () => {
    const user = userEvent.setup();
    const { onDelete } = renderTable();

    await user.click(screen.getByRole("button", { name: "Xoá" }));
    await user.type(screen.getByLabelText("Lý do xoá"), "  Tài khoản kiểm thử  ");
    await user.click(screen.getByRole("button", { name: "Xác nhận xoá" }));

    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "CD-001" }), "Tài khoản kiểm thử");
  });

  it("lý do bỏ trống vẫn xoá được — khác với khoá tài khoản (bắt buộc nêu lý do)", async () => {
    const user = userEvent.setup();
    const { onDelete } = renderTable();

    await user.click(screen.getByRole("button", { name: "Xoá" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận xoá" }));

    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "CD-001" }), "");
  });

  it("ở thùng đã xoá: hiện chip Đã xoá và khôi phục ngay, không cần xác nhận", async () => {
    const user = userEvent.setup();
    const deleted = makeCitizen({ isDeleted: true, deletedAt: "2026-09-06T03:06:00.000Z", deletedBy: "admin" });
    const { onRestore } = renderTable({ citizens: [deleted], deletedView: true });

    // Tài khoản đã xoá không còn nút khoá/mở khoá
    expect(screen.queryByRole("button", { name: /Khoá/ })).toBeNull();
    expect(screen.getAllByText("Đã xoá").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Khôi phục" }));

    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ id: "CD-001" }));
  });
});
