import { describe, expect, it } from "vitest";
import { deadlineLabel, formatBillion, formatNumber, nameInitials, progressColor, slaLabel } from "./format";

describe("progressColor", () => {
  it("trả màu xanh lá từ 80% trở lên", () => {
    expect(progressColor(80)).toBe("var(--green)");
    expect(progressColor(100)).toBe("var(--green)");
    expect(progressColor(140)).toBe("var(--green)");
  });

  it("trả màu xanh dương trong khoảng 50–79%", () => {
    expect(progressColor(50)).toBe("var(--blue)");
    expect(progressColor(79.9)).toBe("var(--blue)");
  });

  it("trả màu cam trong khoảng 30–49%", () => {
    expect(progressColor(30)).toBe("var(--orange)");
    expect(progressColor(49)).toBe("var(--orange)");
  });

  it("trả màu đỏ khi dưới 30%, kể cả 0 và số âm", () => {
    expect(progressColor(29)).toBe("var(--red)");
    expect(progressColor(0)).toBe("var(--red)");
    expect(progressColor(-5)).toBe("var(--red)");
  });
});

describe("deadlineLabel", () => {
  it("đánh dấu quá hạn khi số ngày còn lại âm", () => {
    expect(deadlineLabel(-1)).toEqual({ text: "Quá hạn 1 ngày", color: "var(--red)", late: true });
    expect(deadlineLabel(-12)).toEqual({ text: "Quá hạn 12 ngày", color: "var(--red)", late: true });
  });

  it("hiển thị 'Đến hạn hôm nay' khi còn 0 ngày và không coi là trễ", () => {
    expect(deadlineLabel(0)).toEqual({ text: "Đến hạn hôm nay", color: "var(--orange)", late: false });
  });

  it("cảnh báo cam khi còn từ 1 đến 3 ngày", () => {
    expect(deadlineLabel(1)).toEqual({ text: "Còn 1 ngày", color: "var(--orange)", late: false });
    expect(deadlineLabel(3)).toEqual({ text: "Còn 3 ngày", color: "var(--orange)", late: false });
  });

  it("hiển thị xanh lá khi còn trên 3 ngày", () => {
    expect(deadlineLabel(4)).toEqual({ text: "Còn 4 ngày", color: "var(--green)", late: false });
    expect(deadlineLabel(30)).toEqual({ text: "Còn 30 ngày", color: "var(--green)", late: false });
  });

  it("chỉ đặt cờ late cho trường hợp quá hạn", () => {
    expect([0, 1, 3, 4, 99].every((d) => deadlineLabel(d).late === false)).toBe(true);
  });
});

describe("slaLabel", () => {
  it("ưu tiên trạng thái hoàn thành, kể cả khi đã quá hạn", () => {
    expect(slaLabel(-48, true)).toEqual({ text: "Hoàn thành", color: "var(--green)" });
    expect(slaLabel(100, true)).toEqual({ text: "Hoàn thành", color: "var(--green)" });
  });

  it("báo quá hạn theo số giờ dương khi số giờ còn lại âm", () => {
    expect(slaLabel(-1, false)).toEqual({ text: "Quá hạn 1 giờ", color: "var(--red)" });
    expect(slaLabel(-36, false)).toEqual({ text: "Quá hạn 36 giờ", color: "var(--red)" });
  });

  it("cảnh báo cam khi còn tối đa 12 giờ, bao gồm mốc 0 giờ", () => {
    expect(slaLabel(0, false)).toEqual({ text: "Còn 0 giờ", color: "var(--orange)" });
    expect(slaLabel(12, false)).toEqual({ text: "Còn 12 giờ", color: "var(--orange)" });
  });

  it("hiển thị xanh lá khi còn trên 12 giờ", () => {
    expect(slaLabel(13, false)).toEqual({ text: "Còn 13 giờ", color: "var(--green)" });
    expect(slaLabel(72, false)).toEqual({ text: "Còn 72 giờ", color: "var(--green)" });
  });
});

describe("nameInitials", () => {
  it("lấy chữ đầu của họ và chữ đầu của tên", () => {
    expect(nameInitials("Nguyễn Văn Bình")).toBe("NB");
    expect(nameInitials("Lê Minh Tuấn")).toBe("LT");
    expect(nameInitials("Trần Thị Hạnh")).toBe("TH");
  });

  it("khớp với bảng viết tắt cấu hình sẵn của danh bạ cán bộ", () => {
    const table: Array<[string, string]> = [
      ["Phạm Thị Ngọc", "PN"],
      ["Vũ Đức Anh", "VA"],
      ["Đỗ Thanh Hà", "ĐH"],
      ["Hoàng Văn Sơn", "HS"],
      ["Ngô Thị Lan", "NL"],
      ["Bùi Quang Khải", "BK"],
    ];
    expect(table.map(([name]) => nameInitials(name))).toEqual(table.map(([, expected]) => expected));
  });

  it("trả về một chữ cái với tên chỉ có một từ", () => {
    expect(nameInitials("Bình")).toBe("B");
    expect(nameInitials("an")).toBe("A");
  });

  it("bỏ qua khoảng trắng thừa ở đầu, cuối và giữa các từ", () => {
    expect(nameInitials("  Nguyễn   Văn   Bình  ")).toBe("NB");
  });

  it("trả về '?' với chuỗi rỗng hoặc toàn khoảng trắng", () => {
    expect(nameInitials("")).toBe("?");
    expect(nameInitials("   ")).toBe("?");
  });

  it("viết hoa kết quả kể cả khi tên nhập chữ thường", () => {
    expect(nameInitials("nguyễn văn bình")).toBe("NB");
  });
});

describe("formatNumber", () => {
  it("dùng dấu chấm phân tách hàng nghìn theo locale vi-VN", () => {
    expect(formatNumber(1204)).toBe("1.204");
    expect(formatNumber(1_000_000)).toBe("1.000.000");
    expect(formatNumber(0)).toBe("0");
  });
});

describe("formatBillion", () => {
  it("dùng dấu phẩy thập phân và hậu tố 'tỷ'", () => {
    expect(formatBillion(8.5)).toBe("8,5 tỷ");
  });

  it("bỏ phần thập phân khi là số nguyên", () => {
    expect(formatBillion(0)).toBe("0 tỷ");
    expect(formatBillion(12)).toBe("12 tỷ");
  });

  it("làm tròn về tối đa 1 chữ số thập phân", () => {
    expect(formatBillion(12.35)).toBe("12,4 tỷ");
    expect(formatBillion(0.04)).toBe("0 tỷ");
    expect(formatBillion(1234.56)).toBe("1.234,6 tỷ");
  });

  it("giữ dấu âm cho số âm", () => {
    expect(formatBillion(-2.5)).toBe("-2,5 tỷ");
  });
});
