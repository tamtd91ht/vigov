import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddBudgetForm } from "./AddBudgetForm";

/**
 * VÌ SAO TEST: kế hoạch vốn là số tiền, mà cán bộ Việt gõ dấu phẩy thập phân
 * theo phản xạ ("3,7") trong khi máy chủ chỉ nhận số. Nếu chỗ quy đổi này hỏng,
 * form vẫn gửi đi được nhưng hạng mục vào CSDL với kế hoạch vốn NaN / 0 — sai
 * lặng lẽ và phải sửa tay trong CSDL.
 */

const onSubmit = vi.fn();

function renderForm() {
  render(
    <AddBudgetForm
      open
      onClose={vi.fn()}
      departments={["Văn phòng UBND", "Địa chính – Xây dựng"]}
      years={[2026, 2025]}
      defaultYear={2026}
      saving={false}
      onSubmit={onSubmit}
    />,
  );
}

/** Điền các ô bắt buộc, trừ kế hoạch vốn để từng test tự đặt */
async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Tên hạng mục/), "Cải tạo đường trục thôn Đông");
  await user.selectOptions(screen.getByLabelText(/Đơn vị chủ trì/), "Địa chính – Xây dựng");
}

describe("AddBudgetForm", () => {
  beforeEach(() => onSubmit.mockReset());

  it("dấu phẩy thập phân được quy đổi thành số cho máy chủ", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Kế hoạch vốn/), "3,7");
    await user.click(screen.getByRole("button", { name: "Lưu hạng mục" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Cải tạo đường trục thôn Đông",
        owner: "Địa chính – Xây dựng",
        year: 2026,
        planned: 3.7,
      }),
    );
  });

  it("dấu chấm thập phân cũng hợp lệ", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Kế hoạch vốn/), "1.25");
    await user.click(screen.getByRole("button", { name: "Lưu hạng mục" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ planned: 1.25 }));
  });

  it("bỏ trống ô bắt buộc thì báo lỗi tiếng Việt và không gọi API", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Lưu hạng mục" }));

    expect(screen.getByText("Vui lòng nhập tên hạng mục")).toBeInTheDocument();
    expect(screen.getByText("Vui lòng chọn đơn vị chủ trì")).toBeInTheDocument();
    expect(screen.getByText("Vui lòng nhập kế hoạch vốn được giao")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("kế hoạch vốn không phải số dương thì chặn lại", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Kế hoạch vốn/), "chưa rõ");
    await user.click(screen.getByRole("button", { name: "Lưu hạng mục" }));

    expect(screen.getByText("Kế hoạch vốn phải là số lớn hơn 0")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("chọn nguồn vốn khác thì hiện ô nhập tên nguồn và bắt buộc điền", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Kế hoạch vốn/), "2");
    await user.selectOptions(screen.getByLabelText(/^Nguồn vốn/), "__custom__");
    await user.click(screen.getByRole("button", { name: "Lưu hạng mục" }));

    expect(screen.getByText("Vui lòng nhập tên nguồn vốn")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Tên nguồn vốn/), "Vốn xã hội hoá");
    await user.click(screen.getByRole("button", { name: "Lưu hạng mục" }));

    // Nguồn tự nhập không có màu quy ước — để backend dùng màu mặc định của nó
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ fundingSource: "Vốn xã hội hoá", fundingColor: undefined }),
    );
  });

  it("nguồn vốn trong danh mục gửi kèm màu nhận diện", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Kế hoạch vốn/), "2");
    await user.selectOptions(screen.getByLabelText(/^Nguồn vốn/), "Vốn sự nghiệp");
    await user.click(screen.getByRole("button", { name: "Lưu hạng mục" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ fundingSource: "Vốn sự nghiệp", fundingColor: "var(--teal)" }),
    );
  });
});
