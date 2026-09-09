"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CitizenFeedback } from "@/types";
import { useCategoryDirectory } from "@/services/category-directory";
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
import { useRealtime } from "@/hooks/useRealtime";
import { ApiError } from "@/services/api";
import { feedbackService } from "@/services/feedback.service";
import { REALTIME_EVENTS } from "@/services/realtime.service";
import { FeedbackDrawer } from "./FeedbackDrawer";
import { FeedbackGrid } from "./FeedbackGrid";
import { StatCards } from "./StatCards";

const STATUS_OPTIONS = [{ key: "all", label: "Tất cả" }, ...feedbackStatuses.map((s) => ({ key: s.key, label: s.label }))];

/** Số phiếu tải về mỗi lần — trang Phản ánh hiển thị dạng lưới thẻ */
const PAGE_SIZE = 60;

/** Thông báo lỗi hiển thị cho người dùng, ưu tiên thông điệp backend trả về */
function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** Trang Phản ánh người dân (WBS #6) — dữ liệu từ API /feedback */
export function FeedbackPage() {
  // Chip lọc lĩnh vực lấy theo danh mục hiện hành, gồm cả lĩnh vực cán bộ mới thêm
  const categoryChips = useCategoryDirectory().map((c) => ({ key: c.key, label: c.label }));
  const { showToast } = useToast();
  /** Mã phiếu trên thanh địa chỉ (/feedback?code=PA-2608) — do tìm kiếm toàn cục truyền sang */
  const codeParam = useSearchParams().get("code");

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

  /*
   * Mở sẵn ngăn chi tiết theo mã trên thanh địa chỉ — dùng lại đúng state
   * `openCode` mà lưới thẻ vẫn dùng, không dựng luồng dữ liệu riêng.
   *
   * Điều chỉnh state ngay trong render (khuôn mẫu đang dùng ở các drawer) để
   * không thêm lượt render trung gian, và để đóng phiếu rồi thì không mở lại.
   */
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  if (codeParam && codeParam !== appliedCode) {
    setAppliedCode(codeParam);
    setOpenCode(codeParam);
  }

  /*
   * Có biến động phản ánh ở nơi khác (phiếu mới từ Mini App, đồng nghiệp vừa
   * phân công) thì tải lại danh sách, thẻ thống kê và bản chi tiết đang mở.
   */
  useRealtime({
    [REALTIME_EVENTS.feedbackChanged]: () => {
      list.reload();
      stats.reload();
      if (openCode) detail.reload();
    },
  });

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

  /**
   * Đồng ý cho người dân thu hồi — phiếu bị gỡ khỏi hàng đợi.
   *
   * Không dùng `runWrite`: phiếu đã gỡ KHÔNG còn trong danh sách mặc định nữa,
   * nên vá tại chỗ như các thao tác khác sẽ để lại một dòng ma. Phải đóng drawer
   * rồi tải lại cả danh sách và thống kê từ máy chủ.
   */
  function handleApproveWithdraw(code: string, note: string) {
    setSaving(true);
    void (async () => {
      try {
        await feedbackService.approveWithdraw(code, note || undefined);
        showToast(`Đã gỡ phiếu ${code} theo yêu cầu của người dân`);
        setOpenCode(null);
        list.reload();
        stats.reload();
      } catch (err) {
        showToast(errorMessage(err, "Không gỡ được phiếu phản ánh"));
      } finally {
        setSaving(false);
      }
    })();
  }

  /** Từ chối thu hồi — phiếu ở lại hàng đợi, người dân đọc được lý do trên Mini App */
  function handleRejectWithdraw(code: string, note: string) {
    void runWrite(
      () => feedbackService.rejectWithdraw(code, note),
      (updated) => `Đã từ chối thu hồi phiếu ${updated.code} · Người dân sẽ thấy lý do trên Mini App`,
      "Không gửi được quyết định từ chối",
    );
  }

  /** Nút "Chuyển thành công việc" — gọi /workflow/feedback-to-task */
  function handleCreateTask(item: CitizenFeedback) {
    if (!item.id) return;
    const feedbackId = item.id;
    setSaving(true);
    void (async () => {
      try {
        const { code } = await feedbackService.createTask({ feedbackId });
        showToast(`Đã tạo nhiệm vụ ${code} từ phiếu phản ánh ${item.code}`);
        // Phiếu vừa có mã nhiệm vụ liên kết + một mốc nhật ký mới — lấy lại từ server
        detail.reload();
        list.reload();
      } catch (err) {
        showToast(errorMessage(err, "Không chuyển được phiếu phản ánh thành nhiệm vụ"));
      } finally {
        setSaving(false);
      }
    })();
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
        <FilterChips chips={categoryChips} active={category} onChange={setCategory} />
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
        onCreateTask={handleCreateTask}
        onApproveWithdraw={handleApproveWithdraw}
        onRejectWithdraw={handleRejectWithdraw}
        saving={saving}
      />
    </div>
  );
}
