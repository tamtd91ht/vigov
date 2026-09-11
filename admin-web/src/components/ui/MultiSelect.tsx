"use client";

import { useMemo, useRef, useState } from "react";
import { Icon } from "@/lib/icons";

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Dòng phụ hiện dưới nhãn, ví dụ bộ phận của cán bộ */
  hint?: string;
}

interface Props {
  options: MultiSelectOption[];
  /** Các giá trị đang chọn. Mảng rỗng = chưa lọc gì */
  value: string[];
  onChange: (next: string[]) => void;
  /** Nhãn khi chưa chọn gì, ví dụ "Tất cả người thực hiện" */
  allLabel: string;
  /** Gợi ý trong ô tìm kiếm */
  searchPlaceholder?: string;
  /** Cho chọn đúng một giá trị — dùng cho ô chọn cơ quan ban hành */
  single?: boolean;
  disabled?: boolean;
}

/** Quá số này thì hiện "N mục đã chọn" thay vì liệt kê từng nhãn cho khỏi tràn */
const MAX_LABELS_SHOWN = 2;

/**
 * Ô chọn nhiều giá trị có tìm kiếm gợi ý.
 *
 * VÌ SAO KHÔNG DÙNG `<select multiple>`: thẻ đó buộc người dùng giữ Ctrl để
 * chọn nhiều, không có ô tìm kiếm, và trên danh sách vài trăm cán bộ thì không
 * dùng được. Cán bộ xã phần lớn không biết thao tác Ctrl+click.
 *
 * Bàn phím: Tab tới nút → Enter/Space mở, gõ để lọc, Enter chọn mục đầu tiên,
 * Escape đóng. Không bắt buộc dùng chuột.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  allLabel,
  searchPlaceholder = "Nhập để tìm…",
  single = false,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(kw) || (o.hint ?? "").toLowerCase().includes(kw),
    );
  }, [options, keyword]);

  const selectedLabels = value
    .map((v) => options.find((o) => o.value === v)?.label ?? v)
    .filter(Boolean);

  const summary =
    selectedLabels.length === 0
      ? allLabel
      : selectedLabels.length <= MAX_LABELS_SHOWN
        ? selectedLabels.join(", ")
        : `${selectedLabels.length} mục đã chọn`;

  const toggle = (optionValue: string) => {
    if (single) {
      onChange(value[0] === optionValue ? [] : [optionValue]);
      setOpen(false);
      setKeyword("");
      return;
    }
    onChange(
      value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue],
    );
  };

  const close = () => {
    setOpen(false);
    setKeyword("");
  };

  return (
    <div
      className="msel"
      ref={boxRef}
      /* Đóng khi con trỏ rời khỏi cả nút và danh sách — không dùng nghe click
         toàn cục vì trang này có nhiều ô lọc cạnh nhau, nghe toàn cục dễ đóng
         mất ô người dùng vừa mở */
      onBlur={(e) => {
        if (!boxRef.current?.contains(e.relatedTarget as Node)) close();
      }}
    >
      <button
        type="button"
        className={value.length > 0 ? "sel msel-btn on" : "sel msel-btn"}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="msel-sum">{summary}</span>
        <Icon name="down" size={14} />
      </button>

      {open && (
        <div className="msel-pop" role="listbox">
          <div className="msel-search">
            <Icon name="search" size={14} />
            <input
              autoFocus
              value={keyword}
              placeholder={searchPlaceholder}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
                if (e.key === "Enter" && filtered[0]) {
                  e.preventDefault();
                  toggle(filtered[0].value);
                }
              }}
            />
          </div>

          <div className="msel-list">
            {filtered.length === 0 ? (
              <div className="msel-empty">Không tìm thấy mục nào phù hợp</div>
            ) : (
              filtered.map((o) => {
                const checked = value.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={checked ? "msel-item on" : "msel-item"}
                    onClick={() => toggle(o.value)}
                    role="option"
                    aria-selected={checked}
                  >
                    <span className="msel-tick">{checked ? <Icon name="check" size={13} /> : null}</span>
                    <span className="msel-lb">
                      {o.label}
                      {o.hint ? <em>{o.hint}</em> : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {!single && value.length > 0 && (
            <button type="button" className="msel-clear" onClick={() => onChange([])}>
              Bỏ chọn tất cả
            </button>
          )}
        </div>
      )}
    </div>
  );
}
