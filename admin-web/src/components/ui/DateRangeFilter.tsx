"use client";

import { useRef, useState } from "react";
import { Icon } from "@/lib/icons";
import {
  DATE_PRESET_GROUPS,
  formatRangeLabel,
  isoWeeksOfYear,
  presetRange,
  type DateRange,
  type DatePresetKind,
} from "@/config/date-range.config";

interface Props {
  value: DateRange;
  onChange: (next: DateRange) => void;
  /** Nhãn khi chưa lọc, ví dụ "Toàn bộ thời gian" */
  allLabel?: string;
}

/**
 * Bộ lọc khoảng thời gian: chọn nhanh theo tuần / tháng / quý / năm, hoặc nhập
 * từ ngày – đến ngày.
 *
 * VÌ SAO CÓ PHẦN CHỌN NHANH: nghiệp vụ hành chính hầu như luôn thống kê theo
 * tháng, quý, năm (báo cáo tháng, báo cáo quý). Bắt cán bộ tự nhớ ngày đầu và
 * ngày cuối tháng rồi nhập tay hai lần là chỗ dễ nhập sai nhất, mà sai một ngày
 * là số liệu báo cáo lệch.
 *
 * Mốc thời gian luôn là ngày theo giờ Việt Nam; backend nhận `from`/`to` dạng
 * `yyyy-MM-dd` và tự chặn hai đầu ngày.
 */
export function DateRangeFilter({ value, onChange, allLabel = "Toàn bộ thời gian" }: Props) {
  const [open, setOpen] = useState(false);
  /** Nhóm đang mở trong bảng chọn nhanh */
  const [kind, setKind] = useState<DatePresetKind>("month");
  const boxRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const label = value.from || value.to ? formatRangeLabel(value) : allLabel;

  const apply = (next: DateRange) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div
      className="drf"
      ref={boxRef}
      onBlur={(e) => {
        if (!boxRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        className={value.from || value.to ? "sel drf-btn on" : "sel drf-btn"}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Icon name="cal" size={14} />
        <span className="drf-sum">{label}</span>
      </button>

      {open && (
        <div className="drf-pop">
          {/* Chọn nhanh */}
          <div className="drf-kinds">
            {DATE_PRESET_GROUPS.map((g) => (
              <button
                key={g.kind}
                type="button"
                className={kind === g.kind ? "drf-kind on" : "drf-kind"}
                onClick={() => setKind(g.kind)}
              >
                {g.label}
              </button>
            ))}
          </div>

          {kind !== "year" && (
            <div className="drf-year">
              <button type="button" className="btn sm" onClick={() => setYear((y) => y - 1)}>
                ‹
              </button>
              <b>Năm {year}</b>
              <button
                type="button"
                className="btn sm"
                disabled={year >= now.getFullYear()}
                onClick={() => setYear((y) => y + 1)}
              >
                ›
              </button>
            </div>
          )}

          <div className={kind === "week" ? "drf-grid weeks" : "drf-grid"}>
            {kind === "year"
              ? /* 5 năm gần nhất — xa hơn thì dùng ô từ ngày / đến ngày */
                Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                  <button key={y} type="button" className="drf-cell" onClick={() => apply(presetRange("year", y))}>
                    {y}
                  </button>
                ))
              : kind === "quarter"
                ? [1, 2, 3, 4].map((q) => (
                    <button
                      key={q}
                      type="button"
                      className="drf-cell"
                      onClick={() => apply(presetRange("quarter", year, q))}
                    >
                      Quý {q}
                    </button>
                  ))
                : kind === "month"
                  ? Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className="drf-cell"
                        onClick={() => apply(presetRange("month", year, m))}
                      >
                        Tháng {m}
                      </button>
                    ))
                  : Array.from({ length: isoWeeksOfYear(year) }, (_, i) => i + 1).map((w) => (
                      <button
                        key={w}
                        type="button"
                        className="drf-cell"
                        title={formatRangeLabel(presetRange("week", year, w))}
                        onClick={() => apply(presetRange("week", year, w))}
                      >
                        T{w}
                      </button>
                    ))}
          </div>

          {/* Nhập tay */}
          <div className="drf-manual">
            <label>
              Từ ngày
              <input
                type="date"
                className="finp"
                value={value.from}
                max={value.to || undefined}
                onChange={(e) => onChange({ ...value, from: e.target.value })}
              />
            </label>
            <label>
              Đến ngày
              <input
                type="date"
                className="finp"
                value={value.to}
                min={value.from || undefined}
                onChange={(e) => onChange({ ...value, to: e.target.value })}
              />
            </label>
          </div>

          <div className="drf-foot">
            <button type="button" className="btn sm" onClick={() => apply({ from: "", to: "" })}>
              Bỏ lọc thời gian
            </button>
            <button type="button" className="btn sm pri" onClick={() => setOpen(false)}>
              Xong
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
