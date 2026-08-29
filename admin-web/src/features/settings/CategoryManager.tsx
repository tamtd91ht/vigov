"use client";

import { useState, type FormEvent } from "react";
import { defaultSlaRules, feedbackCategories, type FeedbackCategory, type SlaRule } from "@/config/sla.config";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { chipTint, slugify } from "./helpers";

/**
 * Tab "Danh mục phản ánh" — danh sách lĩnh vực khởi nguồn từ feedbackCategories,
 * SLA tóm tắt lấy từ rules hiện hành (tab SLA). Thêm/xoá chỉ trên state (persist API P3).
 */

/** 8 màu nhận diện có sẵn trong globals.css (CSS var) */
const COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: "var(--navy)", label: "Xanh navy" },
  { value: "var(--blue)", label: "Xanh dương" },
  { value: "var(--green)", label: "Xanh lá" },
  { value: "var(--teal)", label: "Xanh ngọc" },
  { value: "var(--orange)", label: "Cam" },
  { value: "var(--purple)", label: "Tím" },
  { value: "var(--pink)", label: "Hồng" },
  { value: "var(--red)", label: "Đỏ" },
];

export function CategoryManager({ rules }: { rules: SlaRule[] }) {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<FeedbackCategory[]>(feedbackCategories);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fLabel, setFLabel] = useState("");
  const [fColor, setFColor] = useState(COLOR_OPTIONS[0]?.value ?? "var(--mut)");
  const [fErr, setFErr] = useState("");

  const slaSummary = (categoryKey: string): string => {
    const rule = rules.find((r) => r.categoryKey === categoryKey);
    if (!rule) return "Chưa thiết lập SLA";
    return `Tiếp nhận ${rule.intakeDays} · Xử lý ${rule.resolveDays} ${rule.unit} · ${rule.warnBefore.toLowerCase()}`;
  };

  const openAdd = () => {
    setFLabel("");
    setFColor(COLOR_OPTIONS[0]?.value ?? "var(--mut)");
    setFErr("");
    setDrawerOpen(true);
  };

  const remove = (cat: FeedbackCategory) => {
    // Mock đơn giản: danh mục đã có quy tắc SLA coi như đang được sử dụng
    const inUse = defaultSlaRules.some((r) => r.categoryKey === cat.key);
    if (inUse) {
      showToast(`Danh mục "${cat.label}" đang được sử dụng bởi phản ánh và quy tắc SLA — không thể xoá`);
      return;
    }
    setCategories((prev) => prev.filter((c) => c.key !== cat.key));
    showToast(`Đã xoá danh mục "${cat.label}" (mock)`);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const label = fLabel.trim();
    if (!label) {
      setFErr("Vui lòng nhập tên danh mục");
      return;
    }
    const key = slugify(label) || `danh-muc-${categories.length + 1}`;
    if (categories.some((c) => c.key === key || c.label === label)) {
      setFErr("Danh mục này đã tồn tại");
      return;
    }
    setCategories((prev) => [...prev, { key, label, color: fColor }]);
    setDrawerOpen(false);
    showToast(`Đã thêm danh mục "${label}" (mock)`);
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Danh mục lĩnh vực phản ánh"
          extra={
            <button className="btn sm pri" type="button" onClick={openAdd}>
              <Icon name="plus" size={14} />
              Thêm danh mục
            </button>
          }
        />
        <div className="tw">
          <table className="tb2">
            <thead>
              <tr>
                <th>Lĩnh vực</th>
                <th>SLA hiện hành</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.key} style={{ cursor: "default" }}>
                  <td>
                    <Chip color={c.color} tint={chipTint(c.color)} dot>
                      {c.label}
                    </Chip>
                  </td>
                  <td className="muted">{slaSummary(c.key)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn sm danger" type="button" title="Xoá danh mục" onClick={() => remove(c)}>
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Thêm danh mục phản ánh"
        meta="Danh mục mới cần thiết lập SLA tại tab SLA phản ánh sau khi thêm"
        footer={
          <>
            <button className="btn" type="button" onClick={() => setDrawerOpen(false)}>
              Huỷ
            </button>
            <button className="btn pri" type="submit" form="category-add-form">
              <Icon name="plus" size={14} />
              Thêm danh mục
            </button>
          </>
        }
      >
        <form id="category-add-form" onSubmit={submit}>
          <div className="fgroup">
            <label>
              Tên danh mục <span className="req">*</span>
            </label>
            <input
              className={fErr ? "finp err" : "finp"}
              value={fLabel}
              onChange={(e) => setFLabel(e.target.value)}
              placeholder="vd: Chiếu sáng công cộng"
            />
            {fErr && (
              <div className="tiny" style={{ color: "var(--red)", marginTop: 5 }}>
                {fErr}
              </div>
            )}
          </div>
          <div className="fgroup">
            <label>Màu nhận diện</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <select className="finp" value={fColor} onChange={(e) => setFColor(e.target.value)} style={{ flex: 1 }}>
                {COLOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: fColor,
                  border: "1px solid var(--bd)",
                  flex: "none",
                }}
                title="Xem trước màu"
              />
            </div>
          </div>
        </form>
      </Drawer>
    </>
  );
}
