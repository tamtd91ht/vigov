"use client";

export interface FilterChip {
  key: string;
  label: string;
}

/** Dải chip lọc — chip "all" luôn đứng đầu */
export function FilterChips({
  chips,
  active,
  onChange,
  allLabel = "Tất cả",
}: {
  chips: FilterChip[];
  active: string;
  onChange: (key: string) => void;
  allLabel?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className={`fchip ${active === "all" ? "on" : ""}`} onClick={() => onChange("all")} type="button">
        {allLabel}
      </button>
      {chips.map((c) => (
        <button key={c.key} className={`fchip ${active === c.key ? "on" : ""}`} onClick={() => onChange(c.key)} type="button">
          {c.label}
        </button>
      ))}
    </div>
  );
}
