"use client";

import { useState, type FormEvent } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { DataState } from "@/components/ui/DataState";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { useApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/services/api";
import {
  agencyLevels,
  createAgency,
  deactivateAgency,
  fetchAgencies,
  updateAgency,
  type AgencyRecord,
} from "@/services/settings.service";

/**
 * Tab "Cơ quan ban hành" — danh mục cơ quan cho ô chọn ở form Tiếp nhận văn bản.
 *
 * VÌ SAO CẦN DANH MỤC: trước đây cán bộ nhập tay tên cơ quan. Cùng một cơ quan
 * ra nhiều biến thể ("UBND huyện Đông Phú" / "UBND H. Đông Phú" / chữ thường),
 * làm bộ lọc theo cơ quan không ra hết văn bản và thống kê theo cơ quan sai số.
 *
 * KHÔNG có nút xoá cứng: máy chủ chỉ ẩn cơ quan (`active = false`). Văn bản đã
 * vào sổ giữ tên cơ quan tại thời điểm ban hành, và cơ quan sáp nhập rồi tách
 * lại là chuyện có thật trong hành chính — phải bật lại được.
 */
export function AgencyManager() {
  const { showToast } = useToast();
  const list = useApiResource(() => fetchAgencies(), []);

  const [drawerOpen, setDrawerOpen] = useState(false);
  /** Cơ quan đang sửa; `null` = thêm mới */
  const [editing, setEditing] = useState<AgencyRecord | null>(null);
  const [fName, setFName] = useState("");
  const [fShort, setFShort] = useState("");
  const [fLevel, setFLevel] = useState("huyen");
  const [fOrder, setFOrder] = useState(0);
  const [fErr, setFErr] = useState("");
  const [saving, setSaving] = useState(false);

  const items = list.data ?? [];

  const openAdd = () => {
    setEditing(null);
    setFName("");
    setFShort("");
    setFLevel("huyen");
    setFOrder(0);
    setFErr("");
    setDrawerOpen(true);
  };

  const openEdit = (agency: AgencyRecord) => {
    setEditing(agency);
    setFName(agency.name);
    setFShort(agency.shortName);
    setFLevel(agency.level);
    setFOrder(agency.order);
    setFErr("");
    setDrawerOpen(true);
  };

  const fail = (err: unknown, fallback: string) =>
    showToast(err instanceof ApiError ? err.message : fallback);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = fName.trim();
    if (!name) {
      setFErr("Vui lòng nhập tên cơ quan ban hành");
      return;
    }
    setSaving(true);
    try {
      const input = { name, shortName: fShort.trim(), level: fLevel, order: fOrder };
      if (editing) {
        await updateAgency(editing.id, input);
        showToast(`Đã cập nhật cơ quan "${name}"`);
      } else {
        await createAgency(input);
        showToast(`Đã thêm cơ quan "${name}" vào danh mục`);
      }
      setDrawerOpen(false);
      list.reload();
    } catch (err) {
      fail(err, "Không lưu được cơ quan ban hành. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (agency: AgencyRecord) => {
    try {
      if (agency.active) {
        await deactivateAgency(agency.id);
        showToast(`Đã ẩn "${agency.name}" khỏi ô chọn. Văn bản cũ vẫn giữ nguyên tên cơ quan.`);
      } else {
        await updateAgency(agency.id, { active: true });
        showToast(`Đã dùng lại cơ quan "${agency.name}"`);
      }
      list.reload();
    } catch (err) {
      fail(err, "Không đổi được trạng thái sử dụng. Vui lòng thử lại.");
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Cơ quan ban hành văn bản"
          extra={
            <button className="btn sm pri" type="button" onClick={openAdd}>
              <Icon name="plus" size={15} />
              Thêm cơ quan
            </button>
          }
        />
        <div className="tiny muted" style={{ padding: "0 14px 12px" }}>
          Danh mục này đổ vào ô chọn &quot;Cơ quan ban hành&quot; ở form Tiếp nhận văn bản. Chuẩn
          hoá tên tại đây để bộ lọc và thống kê theo cơ quan không bị lệch.
        </div>

        <DataState
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          empty={items.length === 0}
          emptyMessage="Chưa có cơ quan nào trong danh mục. Trong lúc chưa khai, ô chọn ở form Tiếp nhận văn bản tạm lấy các tên đã nhập trong sổ văn bản."
        >
          <div className="tw">
            <table className="tb2">
              <thead>
                <tr>
                  <th style={{ minWidth: 280 }}>Tên cơ quan</th>
                  <th>Tên viết tắt</th>
                  <th>Cấp</th>
                  <th>Thứ tự</th>
                  <th>Trạng thái</th>
                  <th style={{ width: 150 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((agency) => (
                  <tr key={agency.id}>
                    <td>
                      <div className="tt">{agency.name}</div>
                    </td>
                    <td className="tiny">{agency.shortName || "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Chip color="var(--navy)">{agency.levelLabel}</Chip>
                    </td>
                    <td className="tiny">{agency.order}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {agency.active ? (
                        <Chip color="var(--green)">Đang dùng</Chip>
                      ) : (
                        <Chip color="var(--mut)">Đã ẩn</Chip>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button className="btn sm" type="button" onClick={() => openEdit(agency)}>
                          <Icon name="edit" size={14} />
                          Sửa
                        </button>
                        <button
                          className={agency.active ? "btn sm" : "btn sm pri"}
                          type="button"
                          onClick={() => void toggleActive(agency)}
                          title={
                            agency.active
                              ? "Ẩn khỏi ô chọn; bản ghi và văn bản cũ vẫn giữ nguyên"
                              : "Cho cơ quan này xuất hiện lại trong ô chọn"
                          }
                        >
                          {agency.active ? "Ẩn" : "Dùng lại"}
                        </button>
                      </div>
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
        title={editing ? "Sửa cơ quan ban hành" : "Thêm cơ quan ban hành"}
        meta={editing?.name}
        footer={
          <>
            <button
              className="btn pri"
              type="submit"
              form="agency-form"
              disabled={saving}
            >
              <Icon name="ok" size={15} />
              {saving ? "Đang lưu…" : "Lưu"}
            </button>
            <button
              className="btn"
              type="button"
              style={{ marginLeft: "auto" }}
              onClick={() => setDrawerOpen(false)}
            >
              Huỷ
            </button>
          </>
        }
      >
        <form id="agency-form" onSubmit={submit}>
          <div className="fgroup">
            <label htmlFor="agency-name">
              Tên cơ quan <span className="req">*</span>
            </label>
            <input
              id="agency-name"
              className={fErr ? "finp err" : "finp"}
              value={fName}
              onChange={(e) => {
                setFName(e.target.value);
                setFErr("");
              }}
              placeholder="VD: UBND huyện Đông Phú"
            />
            <div className="fhint">
              Ghi đúng như trên văn bản, đủ cấp hành chính. Đây là tên được lưu vào sổ văn bản.
            </div>
            {fErr && <div className="ferr">{fErr}</div>}
          </div>

          <div className="fgroup">
            <label htmlFor="agency-short">Tên viết tắt</label>
            <input
              id="agency-short"
              className="finp"
              value={fShort}
              onChange={(e) => setFShort(e.target.value)}
              placeholder="VD: UBND H. Đông Phú"
            />
            <div className="fhint">Không bắt buộc. Dùng để hiện gọn trong bảng danh sách.</div>
          </div>

          <div className="fgroup">
            <label htmlFor="agency-level">Cấp hành chính</label>
            <select
              id="agency-level"
              className="finp"
              value={fLevel}
              onChange={(e) => setFLevel(e.target.value)}
            >
              {agencyLevels.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            <div className="fhint">Dùng để nhóm danh sách cho dễ tìm, không ảnh hưởng phân quyền.</div>
          </div>

          <div className="fgroup">
            <label htmlFor="agency-order">Thứ tự hiển thị</label>
            <input
              id="agency-order"
              className="finp"
              type="number"
              min={0}
              value={fOrder}
              onChange={(e) => setFOrder(Number(e.target.value) || 0)}
            />
            <div className="fhint">
              Số nhỏ hiện trước, trong cùng một cấp hành chính. Cùng số thì xếp theo tên.
            </div>
          </div>
        </form>
      </Drawer>
    </>
  );
}
