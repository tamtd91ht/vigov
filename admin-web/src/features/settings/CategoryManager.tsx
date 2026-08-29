"use client";

import { useState, type FormEvent } from "react";
import type { SlaRule } from "@/config/sla.config";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { DataState } from "@/components/ui/DataState";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { useApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/services/api";
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  type CategoryRecord,
} from "@/services/settings.service";
import { invalidateCategoryDirectory } from "@/services/category-directory";
import { chipTint, slugify } from "./helpers";

/**
 * Tab "Danh mục phản ánh" — nguồn dữ liệu là /settings/categories.
 *
 * Mã lĩnh vực (`key`) được suy ra từ tên khi thêm mới và KHÔNG đổi được về sau:
 * nó nằm trong `feedbacks.categoryKey`, `sla_rules.categoryKey` và bộ lọc của
 * Zalo Mini App. Muốn đổi tên hiển thị thì sửa `label`, key giữ nguyên.
 *
 * Việc chặn xoá do máy chủ quyết định (đếm phiếu phản ánh đang tham chiếu) —
 * giao diện chỉ hiển thị lại thông báo, không tự đoán.
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

const DEFAULT_COLOR = COLOR_OPTIONS[0]?.value ?? "var(--mut)";

export function CategoryManager({ rules }: { rules: SlaRule[] }) {
  const { showToast } = useToast();
  const categories = useApiResource(() => fetchCategories(), []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fLabel, setFLabel] = useState("");
  const [fColor, setFColor] = useState(DEFAULT_COLOR);
  const [fErr, setFErr] = useState("");
  const [saving, setSaving] = useState(false);
  /** Mã lĩnh vực đang xoá — khoá nút để tránh bấm hai lần */
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const items = categories.data ?? [];

  const failed = (err: unknown, fallback: string) =>
    showToast(err instanceof ApiError ? err.message : fallback);

  const slaSummary = (categoryKey: string): string => {
    const rule = rules.find((r) => r.categoryKey === categoryKey);
    if (!rule) return "Chưa thiết lập SLA";
    return `Tiếp nhận ${rule.intakeDays} · Xử lý ${rule.resolveDays} ${rule.unit} · ${rule.warnBefore.toLowerCase()}`;
  };

  const openAdd = () => {
    setFLabel("");
    setFColor(DEFAULT_COLOR);
    setFErr("");
    setDrawerOpen(true);
  };

  const remove = async (cat: CategoryRecord) => {
    setBusyKey(cat.key);
    try {
      await deleteCategory(cat.key);
      showToast(`Đã xoá lĩnh vực "${cat.label}"`);
      categories.reload();
      // Các màn khác (bảng phản ánh, biểu đồ báo cáo) đang giữ bản sao — buộc tải lại
      invalidateCategoryDirectory();
    } catch (err) {
      // Máy chủ trả 400 kèm số phiếu đang dùng — hiển thị nguyên văn cho cán bộ
      failed(err, "Không xoá được lĩnh vực");
    } finally {
      setBusyKey(null);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const label = fLabel.trim();
    if (!label) {
      setFErr("Vui lòng nhập tên lĩnh vực");
      return;
    }
    const key = slugify(label);
    if (!key) {
      setFErr("Tên lĩnh vực phải chứa ít nhất một chữ cái hoặc chữ số");
      return;
    }
    if (items.some((c) => c.key === key || c.label === label)) {
      setFErr("Lĩnh vực này đã tồn tại");
      return;
    }

    setSaving(true);
    try {
      await createCategory(key, { label, color: fColor });
      setDrawerOpen(false);
      showToast(`Đã thêm lĩnh vực "${label}". Hãy thiết lập SLA ở tab SLA phản ánh.`);
      categories.reload();
      invalidateCategoryDirectory();
    } catch (err) {
      setFErr(err instanceof ApiError ? err.message : "Không thêm được lĩnh vực");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Danh mục lĩnh vực phản ánh"
          extra={
            <button className="btn sm pri" type="button" onClick={openAdd}>
              <Icon name="plus" size={14} />
              Thêm lĩnh vực
            </button>
          }
        />
        <DataState
          loading={categories.loading}
          error={categories.error}
          onRetry={categories.reload}
          empty={items.length === 0}
          emptyMessage="Chưa có lĩnh vực phản ánh nào"
        >
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
                {items.map((c) => (
                  <tr key={c.key} style={{ cursor: "default" }}>
                    <td>
                      <Chip color={c.color} tint={chipTint(c.color)} dot>
                        {c.label}
                      </Chip>
                    </td>
                    <td className="muted">{slaSummary(c.key)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn sm danger"
                        type="button"
                        title="Xoá lĩnh vực"
                        disabled={busyKey === c.key}
                        onClick={() => remove(c)}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Thêm lĩnh vực phản ánh"
        meta="Lĩnh vực mới cần thiết lập SLA tại tab SLA phản ánh sau khi thêm"
        footer={
          <>
            <button className="btn" type="button" onClick={() => setDrawerOpen(false)}>
              Huỷ
            </button>
            <button
              className={saving ? "btn pri saving" : "btn pri"}
              type="submit"
              form="category-add-form"
              disabled={saving}
            >
              <Icon name="plus" size={14} />
              Thêm lĩnh vực
            </button>
          </>
        }
      >
        <form id="category-add-form" onSubmit={submit}>
          <div className="fgroup">
            <label>
              Tên lĩnh vực <span className="req">*</span>
            </label>
            <input
              className={fErr ? "finp err" : "finp"}
              value={fLabel}
              onChange={(e) => setFLabel(e.target.value)}
              placeholder="vd: Chiếu sáng công cộng"
            />
            {fLabel.trim() && !fErr && (
              <div className="tiny muted" style={{ marginTop: 5 }}>
                Mã lĩnh vực: <code>{slugify(fLabel.trim()) || "—"}</code> — không đổi được sau khi tạo
              </div>
            )}
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
