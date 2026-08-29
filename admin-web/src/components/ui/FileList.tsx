import { Icon } from "@/lib/icons";

export function FileList({ names }: { names: string[] }) {
  return (
    <div className="files">
      {names.map((n, i) => (
        <div key={i} className="file">
          <div className="ph">
            <Icon name="clip" size={20} />
          </div>
          <div className="nm" title={n}>{n}</div>
        </div>
      ))}
    </div>
  );
}
