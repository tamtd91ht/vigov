"use client";

import { useState } from "react";
import type { CitizenFeedback } from "@/types";
import { feedbackCategories } from "@/config/sla.config";
import { feedbackStatuses } from "@/config/status.config";
import { fetchStaffDirectory, findStaffIn } from "@/services/catalogs.service";
import { Icon } from "@/lib/icons";
import { DataState } from "@/components/ui/DataState";
import { FilterChips } from "@/components/ui/FilterChips";
import { PageHead } from "@/components/ui/PageHead";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { useToast } from "@/components/ui/Toast";
import { useApiResource } from "@/hooks/useApiResource";
import { useCatalog } from "@/hooks/useCatalog";
import { ApiError } from "@/services/api";
import { feedbackService } from "@/services/feedback.service";
import { FeedbackDrawer } from "./FeedbackDrawer";
import { FeedbackGrid } from "./FeedbackGrid";
import { StatCards } from "./StatCards";

const STATUS_OPTIONS = [{ key: "all", label: "Tất cả" }, ...feedbackStatuses.map((s) => ({ key: s.key, label: s.label }))];

const CATEGORY_CHIPS = feedbackCategories.map((c) => ({ key: c.key, label: c.label }));

/** Số phiếu tải về mỗi lần — trang Phản ánh hiển thị dạng lưới thẻ */
const PAGE_SIZE = 60;

/** Thông báo lỗi hiển thị cho người dùng, ưu tiên thông điệp backend trả về */
function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** Trang Phản ánh người dân (WBS #6) — dữ liệu từ API /feedback */
export function FeedbackPage() {
  const { showToast } = useToast();

  // Danh bạ cán bộ lấy từ API (GET /catalogs/staff) — tra bộ phận khi phân công
  const staffDirectory = useCatalog(fetchStaffDirectory);

  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Bộ lọc lĩnh vực / trạng thái là tham số truy vấn gửi server, không lọc ở trình duyệt
  const list = useApiResource(
    () => feedbackService.list({ categoryKey: category, status, limit: PAGE_SIZE }),
    [category, status],
  );
  const stats = useApiResource(() => feedbackService.stats(), []);
  const detail = useApiResource(
    () => (openCode ? feedbackService.detail(openCode) : Promise.resolve(null)),
    [openCode],
  );

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  // Trong lúc chờ bản chi tiết mới, tạm dùng bản ghi trong danh sách để drawer không hiện phiếu cũ
  const selected = openCode
    ? (detail.data?.code === openCode ? detail.data : items.find((i) => i.code === openCode)) ?? null
    : null;

  /** Ghi kết quả máy chủ trả về vào danh sách và bản chi tiết đang mở */
  function applyUpdated(updated: CitizenFeedback) {
    list.setData((prev) =>
      prev ? { ...prev, items: prev.items.map((i) => (i.code === updated.code ? updated : i)) } : prev,
    );
    detail.setData((prev) => (prev && prev.code === updated.code ? updated : prev));
  }

  /** Bọc một thao tác ghi: khoá nút, gọi API, báo kết quả thật qua toast */
  async function runWrite(
    action: () => Promise<CitizenFeedback>,
    successMessage: (updated: CitizenFeedback) => string,
    failMessage: string,
  ) {
    setSaving(true);
    try {
      const updated = await action();
      applyUpdated(updated);
      showToast(successMessage(updated));
    } catch (err) {
      showToast(errorMessage(err, failMessage));
    } finally {
      setSaving(false);
    }
  }

  function handleAssign(code: string, staffName: string) {
    const staff = findStaffIn(staffDirectory, staffName);
    void runWrite(
      () => feedbackService.assign(code, { assignee: staffName, department: staff?.department ?? "" }),
      (updated) => `Đã phân công ${updated.assignee} xử lý phiếu ${updated.code}`,
      "Không phân công được cán bộ xử lý",
    );
  }

  function handleTransfer(code: string, department: string, reason: string) {
    void runWrite(
      () => feedbackService.transfer(code, { department, reason }),
      (updated) => `Đã chuyển phiếu ${updated.code} sang ${updated.department}`,
      "Không chuyển được phiếu sang bộ phận khác",
    );
  }

  function handleResolve(code: string, note: string, resultImageFileIds: string[]) {
    void runWrite(
      async () => {
        // Không có ảnh nghiệm thu thì bỏ hẳn trường để backend giữ nguyên danh sách cũ
        const updated = await feedbackService.resolve(code, {
          note,
          resultImageFileIds: resultImageFileIds.length ? resultImageFileIds : undefined,
        });
        // Phiếu xử lý xong làm thay đổi 4 thẻ thống kê — lấy lại số liệu từ server
        stats.reload();
        return updated;
      },
      (updated) => `Đã xác nhận xử lý phiếu ${updated.code} · Hệ thống gửi thông báo kết quả cho công dân`,
      "Không xác nhận được kết quả xử lý",
    );
  }

  return (
    <div className="pg">
      <PageHead
        title="Phản ánh, kiến nghị của người dân"
        sub="Tiếp nhận, phân loại và xử lý phản ánh theo cam kết thời hạn (SLA) từng lĩnh vực"
        actions={
          <>
            <button className="btn" type="button">
              <Icon name="cal" size={15} />
              Tháng {stats.data?.month ?? "—"}
            </button>
            <button className="btn pri" type="button" onClick={() => showToast("Đã mở biểu mẫu tiếp nhận phản ánh trực tiếp")}>
              <Icon name="plus" size={15} />
              Tiếp nhận phản ánh
            </button>
          </>
        }
      />

      <DataState loading={stats.loading} error={stats.error} onRetry={stats.reload}>
        {stats.data && <StatCards stats={stats.data} />}
      </DataState>

      <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <span className="tiny muted" style={{ display: "flex", gap: 6, alignItems: "center", marginRight: 4 }}>
          <Icon name="filter" size={14} />
          Lọc theo lĩnh vực:
        </span>
        <FilterChips chips={CATEGORY_CHIPS} active={category} onChange={setCategory} />
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
        <SegmentControl options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        <span className="tiny muted" style={{ marginLeft: "auto" }}>
          Hiển thị {items.length}/{total} phiếu phản ánh
        </span>
      </div>

      <DataState
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        empty={items.length === 0}
        emptyMessage="Không có phiếu phản ánh nào khớp bộ lọc đã chọn."
      >
        <FeedbackGrid items={items} onOpen={setOpenCode} />
      </DataState>

      <FeedbackDrawer
        item={selected}
        onClose={() => setOpenCode(null)}
        onAssign={handleAssign}
        onTransfer={handleTransfer}
        onResolve={handleResolve}
        saving={saving}
      />
    </div>
  );
}
