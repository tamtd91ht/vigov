import { staffColor, findStaff } from "@/mocks/directory";
import { nameInitials } from "@/lib/format";

export function Avatar({ name, large }: { name: string; large?: boolean }) {
  const staff = findStaff(name);
  const initials = staff?.initials ?? nameInitials(name);
  return (
    <span className={large ? "av lg" : "av"} style={{ background: staffColor(name) }} title={name}>
      {initials}
    </span>
  );
}
