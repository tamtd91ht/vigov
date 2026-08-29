"use client";

import { useState } from "react";
import type { BudgetItem } from "@/types";
import { DataState } from "@/components/ui/DataState";
import { PageHead } from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { useApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/services/api";
import {
  disbursementService,
  type CreateEntryInput,
  type CreateObstacleInput,
} from "@/services/disbursement.service";
import { fetchBudgetYears } from "@/services/catalogs.service";
import { useCatalog } from "@/hooks/useCatalog";
import { SummaryCards } from "./SummaryCards";
import { BudgetList } from "./BudgetList";
import { BudgetDrawer } from "./BudgetDrawer";
import type { DisburseRequestValues } from "./DisburseRequestForm";

/** Thông báo lỗi hiển thị cho người dùng, ưu tiên thông điệp backend trả về */
function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** Trang Theo dõi giải ngân vốn đầu tư (WBS #5) — dữ liệu từ API /disbursement */
export function DisbursementPage() {
  const { showToast } = useToast();

  // Danh mục năm ngân sách lấy từ API (GET /catalogs/budget-years) — mới nhất đứng đầu
  const budgetYears = useCatalog(fetchBudgetYears);

  /** 0 = chưa chọn; mặc định là năm mới nhất có dữ liệu */
  const [yearChoice, setYearChoice] = useState(0);
  const year = yearChoice || budgetYears[0] || new Date().getFullYear();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Năm ngân sách là tham số truy vấn gửi server; summary cũng do server tính
  const list = useApiResource(() => disbursementService.list({ year }), [year]);
  const detail = useApiResource(
    () => (selectedId ? disbursementService.detail(selectedId) : Promise.resolve(null)),
    [selectedId],
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
      patchItem(item.id, { comments: [...item.comments, res.comment] });
      return `${res.message}: ${res.amount}`;
    }, "Không gửi được đề nghị giải ngân");
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
              className={exporting ? "btn pri saving" : "btn pri"}
              type="button"
              onClick={exportReport}
              disabled={exporting}
            >
              <Icon name="down" size={15} />
              Xuất Excel
            </button>
          </>
        }
      />

      <DataState loading={list.loading} error={list.error} onRetry={list.reload}>
        {summary && <SummaryCards summary={summary} items={items} year={year} />}
        {/* Danh sách rỗng vẫn giữ 4 thẻ tóm tắt phía trên nên xử lý riêng trạng thái rỗng */}
        <DataState
          loading={false}
          error={null}
          empty={items.length === 0}
          emptyMessage={`Chưa có hạng mục ngân sách nào của năm ${year}`}
        >
          <BudgetList items={items} onSelect={openItem} />
        </DataState>
      </DataState>

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
        saving={saving}
      />
    </div>
  );
}
