"use client";

import type { ReactNode } from "react";

export interface SegmentOption {
  key: string;
  label: ReactNode;
}

export function SegmentControl({
  options,
  value,
  onChange,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.key} className={o.key === value ? "on" : ""} onClick={() => onChange(o.key)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  );
}
