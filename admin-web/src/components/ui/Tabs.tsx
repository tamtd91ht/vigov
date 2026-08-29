"use client";

export interface TabItem {
  key: string;
  label: string;
}

export function Tabs({ items, active, onChange }: { items: TabItem[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="tabs">
      {items.map((t) => (
        <button key={t.key} className={t.key === active ? "on" : ""} onClick={() => onChange(t.key)} type="button">
          {t.label}
        </button>
      ))}
    </div>
  );
}
