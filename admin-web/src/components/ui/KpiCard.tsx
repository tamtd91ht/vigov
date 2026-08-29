import { Icon, type IconName } from "@/lib/icons";

export interface KpiCardProps {
  value: string;
  label: string;
  sub: string;
  color: string;
  tint: string;
  icon: IconName;
  onClick?: () => void;
}

export function KpiCard({ value, label, sub, color, tint, icon, onClick }: KpiCardProps) {
  return (
    <div className="kpi" style={{ background: tint }} onClick={onClick} role={onClick ? "button" : undefined}>
      <div className="num" style={{ color }}>{value}</div>
      <div className="lb">{label}</div>
      <div className="sub">{sub}</div>
      <div className="kic" style={{ color }}>
        <Icon name={icon} size={19} />
      </div>
    </div>
  );
}
