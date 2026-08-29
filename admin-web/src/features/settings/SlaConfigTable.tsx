"use client";

import { useState } from "react";
import type { SlaRule } from "@/config/sla.config";
import { findCategoryIn, useCategoryDirectory } from "@/services/category-directory";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { ApiError } from "@/services/api";
import { resetSlaSettings, saveSlaSettings } from "@/services/settings.service";
import { chipTint } from "./helpers";

/** Xác nhận trước khi ghi đè toàn bộ bảng SLA bằng bộ mặc định */
const RESTORE_CONFIRM = "Khôi phục toàn bộ bảng SLA về giá trị mặc định? Cấu hình hiện tại sẽ bị ghi đè.";

/**
 * Tab "SLA phản ánh" — bảng thời hạn xử lý theo lĩnh vực, sửa inline.
 * Lưu qua PUT /settings/sla, khôi phục qua POST /settings/sla/reset.
 */
export function SlaConfigTable({
  rules,
  onRulesChange,
}: {
  rules: SlaRule[];
  onRulesChange: (rules: SlaRule[]) => void;
}) {
  const { showToast } = useToast();
  const categories = useCategoryDirectory();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const setField = (categoryKey: string, field: "intakeDays" | "resolveDays", value: number) => {
    onRulesChange(rules.map((r) => (r.categoryKey === categoryKey ? { ...r, [field]: value } : r)));
    setDirty(true);
  };

  const failed = (err: unknown, fallback: string) =>
    showToast(err instanceof ApiError ? err.message : fallback);

  const save = async () => {
    setSaving(true);
    try {
      const next = await saveSlaSettings(rules);
      onRulesChange(next.rules);
      setDirty(false);
      showToast("Đã lưu cấu hình SLA");
    } catch (err) {
      failed(err, "Không lưu được cấu hình SLA");
    } finally {
      setSaving(false);
    }
  };

  const restore = async () => {
    if (!window.confirm(RESTORE_CONFIRM)) return;
    setSaving(true);
    try {
      const next = await resetSlaSettings();
      onRulesChange(next.rules);
      setDirty(false);
      showToast("Đã khôi phục bảng SLA mặc định");
    } catch (err) {
      failed(err, "Không khôi phục được SLA mặc định");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="note" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
        <Icon name="clock" size={15} />
        <span>
          Thời hạn (SLA) tính theo giờ hành chính, không tính ngày nghỉ và ngày lễ. Thay đổi có hiệu lực với các phiếu
          phản ánh tiếp nhận sau thời điểm lưu.
        </span>
      </div>
      <Card>
        <div className="tw">
          <table className="tb2">
            <thead>
              <tr>
                <th>Lĩnh vực phản ánh</th>
                <th>Tiếp nhận, phân loại</th>
                <th>Thời hạn xử lý</th>
                <th>Đơn vị</th>
                <th>Cảnh báo trước hạn</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const cat = findCategoryIn(categories, r.categoryKey);
                return (
                  <tr key={r.categoryKey} style={{ cursor: "default" }}>
                    <td>
                      <Chip color={cat.color} tint={chipTint(cat.color)} dot>
                        {cat.label}
                      </Chip>
                    </td>
                    <td>
                      <input
                        className="inp"
                        type="number"
                        min={1}
                        value={r.intakeDays}
                        onChange={(e) => setField(r.categoryKey, "intakeDays", Number(e.target.value))}
                        aria-label={`Thời hạn tiếp nhận — ${cat.label}`}
                      />
                    </td>
                    <td>
                      <input
                        className="inp"
                        type="number"
                        min={1}
                        value={r.resolveDays}
                        onChange={(e) => setField(r.categoryKey, "resolveDays", Number(e.target.value))}
                        aria-label={`Thời hạn xử lý — ${cat.label}`}
                      />
                    </td>
                    <td>{r.unit}</td>
                    <td>{r.warnBefore}</td>
                    <td>
                      <Chip color="var(--green)" tint="rgba(39,174,96,.12)">
                        Đang áp dụng
                      </Chip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          className={saving ? "btn pri saving" : "btn pri"}
          type="button"
          disabled={!dirty || saving}
          onClick={save}
        >
          <Icon name="ok" size={15} />
          Lưu cấu hình
        </button>
        <button className={saving ? "btn saving" : "btn"} type="button" disabled={saving} onClick={restore}>
          Khôi phục mặc định
        </button>
      </div>
    </>
  );
}
