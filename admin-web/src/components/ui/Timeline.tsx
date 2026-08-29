import type { TimelineItem } from "@/types";

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="tl">
      {items.map((item, i) => (
        <div key={i} className={`tl-it ${item.state}`}>
          <div className="t">{item.title}</div>
          <div className="m">{item.meta}</div>
        </div>
      ))}
    </div>
  );
}
