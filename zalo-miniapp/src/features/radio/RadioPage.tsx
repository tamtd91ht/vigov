import { useMemo, useState } from "react";
import { DemoNote, Note, SectionHead, SubHeader } from "@/components/common";
import { demoConfig } from "@/config/demo.config";
import { DataState } from "@/components/DataState";
import { useApiResource } from "@/hooks/useApiResource";
import { contentService, distinctBy } from "@/services/content.service";
import { useRadio } from "@/state/RadioContext";
import type { RadioBulletin } from "@/types";
import { BulletinRow } from "./BulletinRow";
import { PlayerCard } from "./PlayerCard";

/** Nhãn cố định của màn Truyền thanh phường (WBS #17) */
const PAGE_TITLE = "Truyền thanh phường";
const ALL_LABEL = "Tất cả";
const TODAY_PREFIX = "Hôm nay · ";
const EMPTY_MESSAGE = "Chưa có bản tin trong chuyên mục này";
const KEEP_PLAYING_NOTE = "Giữ phát khi chuyển màn — bản tin tiếp tục ở thanh phát thu nhỏ.";

interface DateGroup {
  date: string;
  items: RadioBulletin[];
}

/** Nhóm theo ngày, giữ nguyên thứ tự mock (ngày mới nhất đứng đầu) */
function groupByDate(items: RadioBulletin[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const b of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === b.date) last.items.push(b);
    else groups.push({ date: b.date, items: [b] });
  }
  return groups;
}

/**
 * Màn "Truyền thanh phường" — nghe lại bản tin của xã theo ngày.
 * Nguồn audio thật lấy từ file storage (P3 #24); Phase 1 mô phỏng tiến độ phát bằng bộ đếm.
 */
export function RadioPage() {
  const { bulletin, playing, play, toggle } = useRadio();
  const [category, setCategory] = useState<string>(ALL_LABEL);

  const resource = useApiResource(() => contentService.listRadio(), []);
  const all = useMemo(() => resource.data ?? [], [resource.data]);

  // Chip chuyên mục lấy từ dữ liệu CMS trả về, không cố định trong mã nguồn
  const categories = useMemo(() => distinctBy(all, (b) => b.category), [all]);

  const groups = useMemo(() => {
    const filtered = category === ALL_LABEL ? all : all.filter((b) => b.category === category);
    return groupByDate(filtered);
  }, [all, category]);

  const onPress = (b: RadioBulletin) => (b.id === bulletin?.id ? toggle() : play(b));

  return (
    <div className="app">
      <SubHeader title={PAGE_TITLE} />
      <div className="page plain">
        <DemoNote>{demoConfig.notes.radio}</DemoNote>
        <PlayerCard />

        <div className="chips-row" style={{ margin: "16px 0 4px" }}>
          {[ALL_LABEL, ...categories].map((c) => (
            <button key={c} className={`fchip ${c === category ? "on" : ""}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>

        <DataState
          loading={resource.loading}
          error={resource.error}
          onRetry={resource.reload}
          empty={groups.length === 0}
          emptyIcon="radio"
          emptyMessage={EMPTY_MESSAGE}
        >
          {groups.map((g, i) => (
            <div key={g.date}>
              <SectionHead title={i === 0 ? `${TODAY_PREFIX}${g.date}` : g.date} />
              {g.items.map((b) => (
                <BulletinRow
                  key={b.id}
                  bulletin={b}
                  current={b.id === bulletin?.id}
                  playing={playing}
                  onPress={() => onPress(b)}
                />
              ))}
            </div>
          ))}
        </DataState>

        <div className="divider" />
        <Note icon="info">{KEEP_PLAYING_NOTE}</Note>
      </div>
    </div>
  );
}
