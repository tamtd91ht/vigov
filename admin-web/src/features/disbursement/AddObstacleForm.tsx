"use client";

import { useState, type FormEvent } from "react";
import { fetchStaffDirectory } from "@/services/catalogs.service";
import { useCatalog } from "@/hooks/useCatalog";
import { Icon } from "@/lib/icons";
import type { CreateObstacleInput } from "@/services/disbursement.service";

/**
 * Biểu mẫu thêm vướng mắc cần tháo gỡ (POST /disbursement/:code/obstacles).
 * Chỉ nội dung là bắt buộc; đơn vị chịu trách nhiệm và hạn tháo gỡ tuỳ chọn.
 */
export function AddObstacleForm({
  saving,
  onSubmit,
  onCancel,
}: {
  saving: boolean;
  onSubmit: (values: CreateObstacleInput) => void;
  onCancel: () => void;
}) {
  // Danh bạ cán bộ lấy từ API (GET /catalogs/staff)
  const staffDirectory = useCatalog(fetchStaffDirectory);

  const [content, setContent] = useState("");
  /** Rỗng = chưa chọn; mặc định là cán bộ đầu danh bạ sau khi tải xong */
  const [ownerChoice, setOwnerChoice] = useState("");
  const owner = ownerChoice || staffDirectory[0]?.name || "";
  const [deadline, setDeadline] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim() || saving) return;
    onSubmit({ content: content.trim(), owner, deadline: deadline.trim() });
  }

  return (
    <form
      className={saving ? "saving" : undefined}
      onSubmit={handleSubmit}
      noValidate
      style={{ border: "1px solid var(--bd)", borderRadius: 10, padding: "13px 15px", marginTop: 12 }}
    >
      <div className="fgroup">
        <label htmlFor="ob-content">
          Nội dung vướng mắc <span className="req">*</span>
        </label>
        <input
          id="ob-content"
          className="finp"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ví dụ: Chờ thu hoạch vụ lúa mùa mới thi công được"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="fgroup">
          <label htmlFor="ob-owner">Phụ trách tháo gỡ</label>
          <select id="ob-owner" className="finp" value={owner} onChange={(e) => setOwnerChoice(e.target.value)}>
            {staffDirectory.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} — {s.department}
              </option>
            ))}
          </select>
        </div>
        <div className="fgroup">
          <label htmlFor="ob-deadline">Hạn tháo gỡ</label>
          <input
            id="ob-deadline"
            className="finp"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            placeholder="dd/MM/yyyy"
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn sm pri" type="submit" disabled={!content.trim() || saving}>
          <Icon name="ok" size={14} />
          Thêm vướng mắc
        </button>
        <button className="btn sm" type="button" onClick={onCancel} disabled={saving}>
          Huỷ
        </button>
      </div>
    </form>
  );
}
