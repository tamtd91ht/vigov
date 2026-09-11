"use client";

import { formatVndNumber, parseVndInput, readVndRough } from "@/lib/money";

interface Props {
  id?: string;
  /** Số nguyên ĐỒNG; `null` = ô đang trống */
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  /** Cho phép số âm — chỉ dùng ở ô điều chỉnh dự toán (giảm dự toán) */
  allowNegative?: boolean;
}

/**
 * Ô nhập số tiền, đơn vị ĐỒNG.
 *
 * VÌ SAO KHÔNG CHO NHẬP ĐƠN VỊ DẠNG CHỮ: bản cũ nhận chuỗi tự do ("1,25 tỷ",
 * "800 triệu") rồi đoán đơn vị bằng biểu thức chính quy. Gõ "1,200 triệu" —
 * chuyện xảy ra hằng ngày vì cán bộ quen dấu phẩy — bị hiểu thành 1,2 triệu thay
 * vì 1.200 triệu, tức SAI 1000 LẦN, và không có gì cảnh báo.
 *
 * Nay chỉ nhận chữ số. Bù lại hai thứ giúp gõ không sai:
 *   1. Tự tách nhóm nghìn ngay khi gõ, để đếm số 0 bằng mắt.
 *   2. Đọc số thành chữ bên dưới ("1 tỷ 200 triệu đồng") để tự kiểm.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder = "Nhập số tiền, đơn vị đồng",
  disabled,
  error,
  allowNegative = false,
}: Props) {
  const negative = allowNegative && (value ?? 0) < 0;
  const display = value === null ? "" : formatVndNumber(Math.abs(value));

  const apply = (raw: string) => {
    const parsed = parseVndInput(raw);
    if (parsed === null) {
      onChange(null);
      return;
    }
    onChange(negative ? -parsed : parsed);
  };

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {allowNegative && (
          <select
            className="finp"
            style={{ width: 96, flex: "none" }}
            value={negative ? "giam" : "tang"}
            disabled={disabled}
            onChange={(e) => {
              const abs = Math.abs(value ?? 0);
              onChange(abs === 0 ? null : e.target.value === "giam" ? -abs : abs);
            }}
            aria-label="Chiều điều chỉnh"
          >
            <option value="tang">Tăng</option>
            <option value="giam">Giảm</option>
          </select>
        )}
        <input
          id={id}
          className={error ? "finp err" : "finp"}
          inputMode="numeric"
          autoComplete="off"
          value={display}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => apply(e.target.value)}
        />
        <span className="tiny muted" style={{ flex: "none" }}>
          đồng
        </span>
      </div>
      {/* Đọc số để cán bộ tự kiểm đã gõ đủ số 0 chưa */}
      {value !== null && value !== 0 && (
        <div className="fhint">
          {negative ? "Giảm " : ""}
          {readVndRough(Math.abs(value))}
        </div>
      )}
    </>
  );
}
