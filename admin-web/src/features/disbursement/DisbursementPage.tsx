"use client";

import { useState } from "react";
import type { BudgetItem, DisbursementRequestStatus } from "@/types";
import { DataState } from "@/components/ui/DataState";
import { PageHead } from "@/components/ui/PageHead";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { FilterChips } from "@/components/ui/FilterChips";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { useApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/services/api";
import {
  disbursementService,
  type CreateBudgetInput,
  type CreateEntryInput,
  type CreateObstacleInput,
} from "@/services/disbursement.service";
import { fetchBudgetYears, fetchDepartments } from "@/services/catalogs.service";
import { useCatalog } from "@/hooks/useCatalog";
import { authService } from "@/services/auth";
import { findRole } from "@/config/roles.config";
import { SummaryCards } from "./SummaryCards";
import { BudgetList } from "./BudgetList";
import { BudgetDrawer } from "./BudgetDrawer";
import { AddBudgetForm } from "./AddBudgetForm";
import { RequestTable } from "./RequestTable";
import type { DisburseRequestValues } from "./DisburseRequestForm";

/** Hai màn hình của phân hệ: hạng mục ngân sách và đề nghị giải ngân */
const VIEW_OPTIONS = [
  { key: "items", label: "Hạng mục ngân sách" },
  { key: "requests", label: "Đề nghị giải ngân" },
];

/** Hai chế độ xem danh sách hạng mục: đang dùng và thùng đã xoá */
const SCOPE_CHIPS = [
  { key: "active", label: "Đang dùng" },
  { key: "deleted", label: "Đã xoá" },
];

/** Thông báo lỗi hiển thị cho người dùng, ưu tiên thông điệp backend trả về */
function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** Trang Theo dõi giải ngân vốn đầu tư (WBS #5) — dữ liệu từ API /disbursement */
export function DisbursementPage() {
  const { showToast } = useToast();

  // Danh mục năm ngân sách lấy từ API (GET /catalogs/budget-years) — mới nhất đứng đầu
  const budgetYears = useCatalog(fetchBudgetYears);
  // Danh mục bộ phận cho ô "Đơn vị chủ trì" của biểu mẫu thêm hạng mục
  const departments = useCatalog(fetchDepartments);

  /** 0 = chưa chọn; mặc định là năm mới nhất có dữ liệu */
  const [yearChoice, setYearChoice] = useState(0);
  const year = yearChoice || budgetYears[0] || new Date().getFullYear();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [view, setView] = useState("items");
  const [scope, setScope] = useState("active");
  const [requestStatus, setRequestStatus] = useState<DisbursementRequestStatus | "all">("all");

  /*
   * Quyền lấy từ vai trò của phiên đăng nhập. Ẩn hẳn nút vượt quyền thay vì để
   * bấm rồi nhận 403 — cùng cách làm với nút xoá tài khoản công dân ở phân hệ
   * Người dùng. Máy chủ vẫn là nơi quyết định cuối cùng.
   */
  const roleModules = findRole(authService.getSession()?.roleKey ?? "")?.modules;
  const permission = roleModules?.disbursement;
  const canApprove = permission === "approve" || permission === "admin";
  const canEdit = permission === "edit" || canApprove;
  const canDelete = permission === "admin";
  const showingDeleted = scope === "deleted";

  // Năm ngân sách là tham số truy vấn gửi server; summary cũng do server tính
  const list = useApiResource(
    () => disbursementService.list({ year, deleted: showingDeleted || undefined }),
    [year, showingDeleted],
  );
  const detail = useApiResource(
    () => (selectedId ? disbursementService.detail(selectedId) : Promise.resolve(null)),
    [selectedId],
  );
  /* Danh sách đề nghị chỉ tải khi đang ở màn hình đó — tránh gọi thừa mỗi lần đổi năm */
  const requests = useApiResource(
    () =>
      view === "requests"
        ? disbursementService.listRequests({
            year,
            status: requestStatus === "all" ? undefined : requestStatus,
          })
        : Promise.resolve(null),
    [view, year, requestStatus],
  );

  const items = list.data?.items ?? [];
  const summary = list.data?.summary ?? null;
  // Trong lúc chờ bản chi tiết mới, tạm dùng bản ghi trong danh sách để drawer không hiện hạng mục cũ
  const selected = selectedId
    ? (detail.data?.id === selectedId ? detail.data : items.find((it) => it.id === selectedId)) ?? null
    : null;

  function openItem(item: BudgetItem) {
    setSelectedId(item.id);
    setDrawerOpen(true);
  }

  /** Ghi kết quả máy chủ trả về vào danh sách và bản chi tiết đang mở */
  function patchItem(code: string, patch: Partial<BudgetItem>) {
    list.setData((prev) =>
      prev ? { ...prev, items: prev.items.map((it) => (it.id === code ? { ...it, ...patch } : it)) } : prev,
    );
    detail.setData((prev) => (prev && prev.id === code ? { ...prev, ...patch } : prev));
  }

  /** Bọc một thao tác ghi: khoá nút, gọi API, báo kết quả thật qua toast */
  async function runWrite(action: () => Promise<string>, failMessage: string) {
    setSaving(true);
    try {
      showToast(await action());
    } catch (err) {
      showToast(errorMessage(err, failMessage));
    } finally {
      setSaving(false);
    }
  }

  function addComment(content: string) {
    if (!selected) return;
    const item = selected;
    void runWrite(async () => {
      const comment = await disbursementService.addComment(item.id, content);
      patchItem(item.id, { comments: [...item.comments, comment] });
      return "Đã gửi nội dung trao đổi";
    }, "Không gửi được nội dung trao đổi");
  }

  function addEntry(values: CreateEntryInput) {
    if (!selected) return;
    const item = selected;
    void runWrite(async () => {
      const res = await disbursementService.addEntry(item.id, values);
      patchItem(item.id, {
        planned: res.planned,
        actual: res.actual,
        delayed: res.delayed,
        entries: [...item.entries, res.entry],
      });
      // Luỹ kế đổi thì số liệu tổng hợp toàn xã cũng đổi — lấy lại từ server
      list.reload();
      return `Đã ghi nhận giải ngân ${res.entry.amount} cho hạng mục ${res.code} (đạt ${res.percent}%)`;
    }, "Không ghi nhận được lần giải ngân");
  }

  function addObstacle(values: CreateObstacleInput) {
    if (!selected) return;
    const item = selected;
    void runWrite(async () => {
      const obstacles = await disbursementService.addObstacle(item.id, values);
      patchItem(item.id, { obstacles });
      return "Đã thêm vướng mắc cần tháo gỡ";
    }, "Không thêm được vướng mắc");
  }

  function resolveObstacle(index: number) {
    if (!selected) return;
    const item = selected;
    void runWrite(async () => {
      const res = await disbursementService.resolveObstacle(item.id, index);
      patchItem(item.id, { obstacles: res.obstacles });
      // Máy chủ ghi thêm một bình luận hệ thống — nạp lại chi tiết để thấy đầy đủ
      detail.reload();
      return `Đã đánh dấu tháo gỡ vướng mắc: ${res.resolved.content}`;
    }, "Không cập nhật được vướng mắc");
  }

  function submitRequest(values: DisburseRequestValues) {
    if (!selected) return;
    const item = selected;
    void runWrite(async () => {
      const res = await disbursementService.createRequest(item.id, values);
      patchItem(item.id, {
        comments: [...item.comments, res.comment],
        requests: [...item.requests, res.request],
      });
      return `Đã gửi đề nghị ${res.request.code}: ${res.amount} — chờ lãnh đạo duyệt`;
    }, "Không gửi được đề nghị giải ngân");
  }

  /**
   * Ba thao tác vòng đời đề nghị, nhận thẳng mã hạng mục và mã đề nghị nên
   * dùng chung được cho cả màn hình quản lý đề nghị lẫn ngăn chi tiết hạng mục.
   */

  /** Duyệt đề nghị (quyền approve) — chưa cộng tiền, chỉ đổi trạng thái */
  function approveRequestIn(budgetCode: string, requestCode: string) {
    void runWrite(async () => {
      const updated = await disbursementService.approveRequest(budgetCode, requestCode);
      requests.reload();
      if (selectedId === budgetCode) detail.reload();
      return `Đã duyệt đề nghị ${updated.code} · ${updated.amount} — chờ ghi nhận đã chi`;
    }, "Không duyệt được đề nghị giải ngân");
  }

  /** Từ chối đề nghị kèm lý do (quyền approve) */
  function rejectRequestIn(budgetCode: string, requestCode: string, reason: string) {
    void runWrite(async () => {
      const updated = await disbursementService.rejectRequest(budgetCode, requestCode, reason);
      requests.reload();
      if (selectedId === budgetCode) detail.reload();
      return `Đã từ chối đề nghị ${updated.code}`;
    }, "Không từ chối được đề nghị giải ngân");
  }

  /**
   * Ghi nhận đề nghị đã chi thật — máy chủ cộng luỹ kế và sinh một dòng trong
   * Lịch sử giải ngân, nên phải tải lại cả danh sách hạng mục (số liệu tổng
   * hợp toàn xã đổi theo).
   */
  function disburseRequestIn(budgetCode: string, requestCode: string, voucherNo: string) {
    void runWrite(async () => {
      const res = await disbursementService.disburseRequest(budgetCode, requestCode, { voucherNo });
      requests.reload();
      list.reload();
      if (selectedId === budgetCode) detail.reload();
      return `Đã ghi nhận giải ngân ${res.request.amount} cho ${res.code} (đạt ${res.percent}%)`;
    }, "Không ghi nhận được lần chi");
  }

  /** Xoá mềm hạng mục (quyền admin) — dữ liệu vẫn giữ, khôi phục được */
  function softDeleteItem(item: BudgetItem, reason: string) {
    void runWrite(async () => {
      await disbursementService.softDelete(item.id, reason || undefined);
      setDrawerOpen(false);
      setSelectedId(null);
      list.reload();
      return `Đã xoá hạng mục ${item.id} · ${item.name}. Khôi phục ở bộ lọc "Đã xoá".`;
    }, "Không xoá được hạng mục ngân sách");
  }

  /** Khôi phục hạng mục đã xoá mềm (quyền admin) */
  function restoreItem(item: BudgetItem) {
    void runWrite(async () => {
      await disbursementService.restore(item.id);
      setDrawerOpen(false);
      setSelectedId(null);
      list.reload();
      return `Đã khôi phục hạng mục ${item.id} · ${item.name}`;
    }, "Không khôi phục được hạng mục ngân sách");
  }

  /**
   * Nhắc tháo gỡ vướng mắc: Phase 1 chưa có kênh nhắc việc riêng nên lời nhắc
   * được ghi vào phần thảo luận của hạng mục (POST /disbursement/:code/comments).
   */
  function remindObstacles() {
    if (!selected) return;
    const item = selected;
    void runWrite(async () => {
      const content = `Đề nghị ${item.owner} khẩn trương tháo gỡ ${item.obstacles.length} vướng mắc của hạng mục ${item.name}.`;
      const comment = await disbursementService.addComment(item.id, content);
      patchItem(item.id, { comments: [...item.comments, comment] });
      return `Đã gửi nhắc tháo gỡ vướng mắc tới ${item.owner}`;
    }, "Không gửi được lời nhắc tháo gỡ vướng mắc");
  }

  /** Tạo hạng mục ngân sách mới — mã HM-xx do máy chủ cấp */
  function createBudget(values: CreateBudgetInput) {
    void runWrite(async () => {
      const created = await disbursementService.create(values);
      setAddOpen(false);
      /* Hạng mục mới làm đổi cả danh sách lẫn 4 thẻ tóm tắt (tổng kế hoạch vốn,
         số hạng mục chậm tiến độ) — số liệu tổng hợp do server tính nên phải
         tải lại chứ không cộng thêm ở trình duyệt. */
      list.reload();
      return `Đã thêm hạng mục ${created.id} · ${created.name}`;
    }, "Không thêm được hạng mục ngân sách");
  }

  async function exportReport() {
    setExporting(true);
    try {
      const kind = await disbursementService.exportYearReport(year, items);
      showToast(
        kind === "excel"
          ? `Đã tải báo cáo giải ngân năm ${year} (Excel)`
          : `Đã xuất báo cáo giải ngân năm ${year} (CSV)`,
      );
    } catch (err) {
      showToast(errorMessage(err, "Không tải được báo cáo giải ngân"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="pg">
      <PageHead
        title="Theo dõi giải ngân vốn đầu tư"
        sub={`Tiến độ giải ngân các hạng mục đầu tư công và vốn sự nghiệp trên địa bàn xã năm ${year}`}
        actions={
          <>
            <select
              className="sel"
              value={year}
              onChange={(e) => setYearChoice(Number(e.target.value))}
              aria-label="Năm ngân sách"
            >
              {budgetYears.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
            <button
              className={exporting ? "btn saving" : "btn"}
              type="button"
              onClick={exportReport}
              disabled={exporting}
            >
              <Icon name="down" size={15} />
              Xuất Excel
            </button>
            <button className="btn pri" type="button" onClick={() => setAddOpen(true)} disabled={saving}>
              <Icon name="plus" size={15} />
              Thêm hạng mục
            </button>
          </>
        }
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <SegmentControl options={VIEW_OPTIONS} value={view} onChange={setView} />
        {/* Bộ lọc "Đã xoá" chỉ có nghĩa với vai trò xoá/khôi phục được */}
        {view === "items" && canDelete && (
          <FilterChips
            chips={SCOPE_CHIPS}
            active={scope}
            onChange={setScope}
            allLabel="Đang dùng"
          />
        )}
      </div>

      {view === "requests" ? (
        <RequestTable
          rows={requests.data?.items ?? []}
          summary={requests.data?.summary ?? null}
          loading={requests.loading}
          error={requests.error}
          onRetry={requests.reload}
          status={requestStatus}
          onStatusChange={setRequestStatus}
          canApprove={canApprove}
          canDisburse={canEdit}
          onApprove={(row) => approveRequestIn(row.budgetCode, row.code)}
          onReject={(row, reason) => rejectRequestIn(row.budgetCode, row.code, reason)}
          onDisburse={(row, voucherNo) => disburseRequestIn(row.budgetCode, row.code, voucherNo)}
          onOpenBudget={(code) => {
            setView("items");
            setScope("active");
            setSelectedId(code);
            setDrawerOpen(true);
          }}
          saving={saving}
        />
      ) : (
        <DataState loading={list.loading} error={list.error} onRetry={list.reload}>
          {summary && !showingDeleted && <SummaryCards summary={summary} items={items} year={year} />}
          {showingDeleted && (
            <div className="note" style={{ marginBottom: 14 }}>
              Hạng mục đã xoá không tính vào số liệu tổng hợp. Mở một hạng mục rồi bấm{" "}
              <b>Khôi phục hạng mục</b> để đưa trở lại danh sách đang dùng.
            </div>
          )}
          {/* Danh sách rỗng vẫn giữ 4 thẻ tóm tắt phía trên nên xử lý riêng trạng thái rỗng */}
          <DataState
            loading={false}
            error={null}
            empty={items.length === 0}
            emptyMessage={
              showingDeleted
                ? "Chưa có hạng mục nào bị xoá"
                : `Chưa có hạng mục ngân sách nào của năm ${year}`
            }
          >
            <BudgetList items={items} onSelect={openItem} />
          </DataState>
        </DataState>
      )}

      <BudgetDrawer
        item={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAddComment={addComment}
        onSubmitRequest={submitRequest}
        onRemindObstacles={remindObstacles}
        onAddEntry={addEntry}
        onAddObstacle={addObstacle}
        onResolveObstacle={resolveObstacle}
        canApprove={canApprove}
        canEdit={canEdit}
        canDelete={canDelete}
        onApproveRequest={approveRequestIn}
        onRejectRequest={rejectRequestIn}
        onDisburseRequest={disburseRequestIn}
        onSoftDelete={softDeleteItem}
        onRestore={restoreItem}
        saving={saving}
      />

      <AddBudgetForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        departments={departments}
        years={budgetYears}
        defaultYear={year}
        saving={saving}
        onSubmit={createBudget}
      />
    </div>
  );
}
