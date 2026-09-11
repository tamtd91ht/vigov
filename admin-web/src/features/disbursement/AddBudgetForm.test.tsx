import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddBudgetForm } from "./AddBudgetForm";

/**
 * VÌ SAO TEST: dự toán là số tiền đi thẳng vào số liệu quyết toán ngân sách.
 *
 * Bản cũ nhận chuỗi tự do rồi quy đổi về "tỷ đồng" số thực — gõ "3,7" ra 3,7 tỷ
 * nhưng gõ "1,200 triệu" lại ra 1,2 triệu (sai 1000 lần), và mọi số đều bị làm
 * tròn tới 10 triệu đồng. Nay ô nhập chỉ nhận CHỮ SỐ và gửi đi SỐ NGUYÊN ĐỒNG.
 *
 * Bộ test này khoá lại đúng điều đó: gõ chữ không lọt, dấu phẩy/dấu chấm bị bỏ
 * qua thay vì bị hiểu thành dấu thập phân, và số gửi lên là số nguyên đồng.
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

/** Điền các ô bắt buộc, trừ dự toán để từng test tự đặt */
async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Tên hạng mục/), "Cải tạo đường trục thôn Đông");
  await user.selectOptions(screen.getByLabelText(/Đơn vị chủ trì/), "Địa chính – Xây dựng");
}

describe("AddBudgetForm", () => {
  beforeEach(() => onSubmit.mockReset());

  it("gửi lên SỐ NGUYÊN ĐỒNG, không phải số thực đơn vị tỷ", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Dự toán giao đầu năm/), "3700000000");
    await user.click(screen.getByRole("button", { name: "Lưu hạng mục" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Cải tạo đường trục thôn Đông",
        owner: "Địa chính – Xây dựng",
        year: 2026,
        initialPlannedDong: 3_700_000_000,
      }),
    );
  });

  it("giữ đúng số lẻ tới đồng — KHÔNG làm tròn", async () => {
    // 823 triệu bị bản cũ lưu thành 820 triệu (mất 3 triệu đồng)
    const user = userEvent.setup();
    renderForm();

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Dự toán giao đầu năm/), "823456789");
    await user.click(screen.getByRole("button", { name: "Lưu hạng mục" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ initialPlannedDong: 823_456_789 }),
    );
  });

  it("gõ dấu phẩy hay dấu chấm thì bị BỎ QUA, không bị hiểu là dấu thập phân", async () => {
    // Đây là chỗ bản cũ sai 1000 lần: "1,200" từng bị hiểu thành 1,2
    const user = userEvent.setup();
    renderForm();

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Dự toán giao đầu năm/), "1,200,000,000");
    await user.click(screen.getByRole("button", { name: "Lưu hạng mục" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ initialPlannedDong: 1_200_000_000 }),
    );
  });

  it("ô tiền tách nhóm nghìn ngay khi gõ để cán bộ đếm số 0 bằng mắt", async () => {
    const user = userEvent.setup();
    renderForm();

    const input = screen.getByLabelText(/Dự toán giao đầu năm/);
    await user.type(input, "850000000");

    expect(input).toHaveValue("850.000.000");
  });

  it("bỏ trống ô bắt buộc thì báo lỗi tiếng Việt và không gọi API", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Lưu hạng mục" }));

    expect(screen.getByText("Vui lòng nhập tên hạng mục")).toBeInTheDocument();
    expect(screen.getByText("Vui lòng chọn đơn vị chủ trì")).toBeInTheDocument();
    expect(screen.getByText("Vui lòng nhập dự toán giao đầu năm")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("gõ chữ vào ô tiền thì không có số nào lọt qua", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Dự toán giao đầu năm/), "chưa rõ");
    await user.click(screen.getByRole("button", { name: "Lưu hạng mục" }));

    expect(screen.getByText("Vui lòng nhập dự toán giao đầu năm")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("chọn nguồn vốn khác thì hiện ô nhập tên nguồn và bắt buộc điền", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Dự toán giao đầu năm/), "2000000000");
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
    await user.type(screen.getByLabelText(/Dự toán giao đầu năm/), "2000000000");
    await user.selectOptions(screen.getByLabelText(/^Nguồn vốn/), "Vốn sự nghiệp");
    await user.click(screen.getByRole("button", { name: "Lưu hạng mục" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ fundingSource: "Vốn sự nghiệp", fundingColor: "var(--teal)" }),
    );
  });
});
