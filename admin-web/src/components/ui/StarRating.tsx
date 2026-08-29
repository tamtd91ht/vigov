import { Icon } from "@/lib/icons";

export function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="stars">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ opacity: i < value ? 1 : 0.22 }}>
          <Icon name="star" size={13} strokeWidth={1.6} />
        </span>
      ))}
    </span>
  );
}
