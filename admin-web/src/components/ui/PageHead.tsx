import type { ReactNode } from "react";

export function PageHead({ title, sub, actions }: { title: string; sub: string; actions?: ReactNode }) {
  return (
    <div className="pg-head">
      <div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {actions && <div className="sp">{actions}</div>}
    </div>
  );
}
