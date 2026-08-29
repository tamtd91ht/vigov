"use client";

import { useState, type FormEvent } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataState } from "@/components/ui/DataState";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { useApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/services/api";
import {
  createOrgNode,
  deleteOrgNode,
  fetchOrgTree,
  updateOrgNode,
  type OrgTreeNode,
} from "@/services/settings.service";

/*
 * Tab "Sơ đồ tổ chức" — cây đệ quy lấy từ GET /settings/org, thao tác thêm/sửa/xoá
 * gọi thẳng POST/PATCH/DELETE rồi tải lại cây theo kết quả máy chủ.
 *
 * Câu hỏi mở #13: quy mô tổ chức thật (số cấp, số đơn vị sau sáp nhập) — chờ khách xác nhận.
 */

/** Màu nhận diện mặc định cho đơn vị mới thêm */
const NEW_UNIT_COLOR = "#5B6C8F";

interface DrawerState {
  mode: "edit" | "add";
  /** Đơn vị đang sửa (mode edit) hoặc đơn vị cha (mode add); null = thêm ở cấp cao nhất */
  target: OrgTreeNode | null;
}

export function OrgTree() {
  const { showToast } = useToast();
  const org = useApiResource(() => fetchOrgTree(), []);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [fName, setFName] = useState("");
  const [fSubtitle, setFSubtitle] = useState("");
  const [fErr, setFErr] = useState("");
  const [saving, setSaving] = useState(false);

  const tree = org.data?.tree ?? [];

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const failed = (err: unknown, fallback: string) => showToast(err instanceof ApiError ? err.message : fallback);

  const openEdit = (node: OrgTreeNode) => {
    setFName(node.name);
    setFSubtitle(node.subtitle);
    setFErr("");
    setDrawer({ mode: "edit", target: node });
  };

  const openAdd = (parent: OrgTreeNode | null) => {
    setFName("");
    setFSubtitle("");
    setFErr("");
    setDrawer({ mode: "add", target: parent });
  };

  const remove = async (node: OrgTreeNode) => {
    if (!window.confirm(`Xoá đơn vị "${node.name}" khỏi sơ đồ tổ chức?`)) return;
    setSaving(true);
    try {
      await deleteOrgNode(node.id);
      showToast(`Đã xoá đơn vị "${node.name}"`);
      org.reload();
    } catch (err) {
      failed(err, "Không xoá được đơn vị");
    } finally {
      setSaving(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!drawer) return;
    const name = fName.trim();
    if (!name) {
      setFErr("Vui lòng nhập tên đơn vị / chức danh");
      return;
    }
    const subtitle = fSubtitle.trim();
    setSaving(true);
    try {
      if (drawer.mode === "edit" && drawer.target) {
        await updateOrgNode(drawer.target.id, { name, subtitle });
        showToast(`Đã cập nhật đơn vị "${name}"`);
      } else {
        await createOrgNode({
          name,
          subtitle,
          color: NEW_UNIT_COLOR,
          parentId: drawer.target?.id,
        });
        showToast(`Đã thêm đơn vị "${name}" vào sơ đồ`);
      }
      setDrawer(null);
      org.reload();
    } catch (err) {
      failed(err, "Không lưu được thông tin đơn vị");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Sơ đồ tổ chức UBND xã"
          extra={
            <>
              <span>{org.data?.total ?? 0} đơn vị</span>
              <button className="btn sm pri" type="button" onClick={() => openAdd(null)}>
                <Icon name="plus" size={14} />
                Thêm đơn vị
              </button>
            </>
          }
        />
        <CardBody>
          <DataState
            loading={org.loading}
            error={org.error}
            onRetry={org.reload}
            empty={tree.length === 0}
            emptyMessage="Chưa có đơn vị nào trong sơ đồ tổ chức"
          >
            <div className="tree">
              {tree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  isRoot
                  collapsed={collapsed}
                  disabled={saving}
                  onToggle={toggle}
                  onEdit={openEdit}
                  onAddChild={openAdd}
                  onRemove={remove}
                />
              ))}
            </div>
          </DataState>
        </CardBody>
      </Card>

      <Drawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        title={drawer?.mode === "add" ? "Thêm đơn vị trực thuộc" : "Sửa thông tin đơn vị"}
        meta={
          !drawer
            ? undefined
            : drawer.mode === "add"
              ? drawer.target
                ? `Thuộc: ${drawer.target.name}`
                : "Đơn vị cấp cao nhất"
              : `Mã đơn vị ${drawer.target?.id ?? ""}`
        }
        footer={
          <>
            <button className="btn" type="button" onClick={() => setDrawer(null)}>
              Huỷ
            </button>
            <button
              className={saving ? "btn pri saving" : "btn pri"}
              type="submit"
              form="org-node-form"
              disabled={saving}
            >
              <Icon name="ok" size={15} />
              {drawer?.mode === "add" ? "Thêm đơn vị" : "Lưu thay đổi"}
            </button>
          </>
        }
      >
        <form id="org-node-form" onSubmit={submit}>
          <div className="fgroup">
            <label>
              Tên đơn vị / chức danh <span className="req">*</span>
            </label>
            <input
              className={fErr ? "finp err" : "finp"}
              value={fName}
              onChange={(e) => setFName(e.target.value)}
              placeholder="vd: Văn phòng UBND"
            />
            {fErr && (
              <div className="tiny" style={{ color: "var(--red)", marginTop: 5 }}>
                {fErr}
              </div>
            )}
          </div>
          <div className="fgroup">
            <label>Phụ đề (người phụ trách, quân số…)</label>
            <input
              className="finp"
              value={fSubtitle}
              onChange={(e) => setFSubtitle(e.target.value)}
              placeholder="vd: Trần Thị Hạnh · 6 cán bộ"
            />
          </div>
        </form>
      </Drawer>
    </>
  );
}

function TreeNode({
  node,
  isRoot,
  collapsed,
  disabled,
  onToggle,
  onEdit,
  onAddChild,
  onRemove,
}: {
  node: OrgTreeNode;
  isRoot?: boolean;
  collapsed: Set<string>;
  disabled: boolean;
  onToggle: (key: string) => void;
  onEdit: (node: OrgTreeNode) => void;
  onAddChild: (node: OrgTreeNode) => void;
  onRemove: (node: OrgTreeNode) => void;
}) {
  const [hover, setHover] = useState(false);
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);

  return (
    <div className="tnode">
      <div
        className="tbox"
        style={isRoot ? { borderLeft: `3px solid ${node.color}` } : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {hasChildren && (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            title={isCollapsed ? "Mở rộng" : "Thu gọn"}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "var(--mut)",
              display: "grid",
              placeItems: "center",
              padding: 0,
            }}
          >
            <Icon name={isCollapsed ? "right" : "down"} size={13} />
          </button>
        )}
        <span className="av" style={{ background: node.color }}>
          <Icon name="build" size={14} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <b>{node.name}</b>
          <span>{node.subtitle}</span>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 4,
            opacity: hover ? 1 : 0,
            pointerEvents: hover ? "auto" : "none",
            transition: "opacity .15s",
          }}
        >
          <button className="btn sm" type="button" title="Sửa" disabled={disabled} onClick={() => onEdit(node)}>
            <Icon name="edit" size={13} />
          </button>
          <button
            className="btn sm"
            type="button"
            title="Thêm đơn vị trực thuộc"
            disabled={disabled}
            onClick={() => onAddChild(node)}
          >
            <Icon name="plus" size={13} />
          </button>
          <button
            className="btn sm danger"
            type="button"
            title="Xoá"
            disabled={disabled}
            onClick={() => onRemove(node)}
          >
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>
      {hasChildren && !isCollapsed && (
        <div className="tkids">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              collapsed={collapsed}
              disabled={disabled}
              onToggle={onToggle}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
