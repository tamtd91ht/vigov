import type { CSSProperties, ReactNode } from "react";

export function Card({ children, style, className }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div className={className ? `card ${className}` : "card"} style={style}>
      {children}
    </div>
  );
}

export function CardHeader({ title, extra }: { title: ReactNode; extra?: ReactNode }) {
  return (
    <div className="card-h">
      <h3>{title}</h3>
      {extra && <div className="sp">{extra}</div>}
    </div>
  );
}

export function CardBody({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="card-b" style={style}>
      {children}
    </div>
  );
}
