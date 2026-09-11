"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/lib/icons";
import { Card } from "@/components/ui/Card";
import { DataState } from "@/components/ui/DataState";
import { PageHead } from "@/components/ui/PageHead";
import { SegmentControl } from "@/components/ui/SegmentControl";
import { FilterChips } from "@/components/ui/FilterChips";
import { useToast } from "@/components/ui/Toast";
import { documentStatuses } from "@/config/status.config";
import { fetchDepartments } from "@/services/catalogs.service";
import { useApiResource } from "@/hooks/useApiResource";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import type { DateRange } from "@/config/date-range.config";
import { useCatalog } from "@/hooks/useCatalog";
import {
  addDocumentAttachments,
  apiErrorMessage,
  confirmAllOcr,
  confirmOcrField,
  createDocument,
  createTaskFromDocument,
  deleteDocument,
  exportDocumentsExcel,
  getDocument,
  listDocuments,
  removeDocumentAttachment,
  restoreDocument,
  runDocumentOcr,
  updateDocument,
  type CreateDocumentInput,
  type DocumentDetail,
  type DocumentKind,
} from "@/services/documents.service";
import { authService, getServerSession } from "@/services/auth";
import { findRole } from "@/config/roles.config";
import { Drawer } from "@/components/ui/Drawer";
import { DocumentTable } from "./DocumentTable";
import { DocumentDrawer } from "./DocumentDrawer";
import { ReceiveDocForm } from "./ReceiveDocForm";

type DocTab = "den" | "dt";

/** Nhãn tab ↔ phân loại sổ của backend */
const KIND_BY_TAB: Record<DocTab, DocumentKind> = {
  den: "incoming",
  dt: "petition",
};

const PAGE_SIZE = 20;

/** Hai thùng dữ liệu loại trừ nhau: đang dùng / đã xoá mềm */
const SCOPE_OPTIONS = [
  { key: "active", label: "Đang dùng" },
  { key: "deleted", label: "Đã xoá" },
];

const DELETE_NOTE =
  "Xoá mềm: văn bản biến mất khỏi sổ văn bản đến, thống kê và tìm kiếm, nhưng bản ghi vẫn nằm " +
  "trong cơ sở dữ liệu — số đến, nhật ký xử lý, bản scan và các trường OCR đã xác nhận đều còn. " +
  'Số đến KHÔNG được cấp lại cho văn bản mới. Khôi phục lại được ở bộ lọc "Đã xoá".';

export function DocumentsPage() {
  const { showToast } = useToast();
  /** Số đến trên thanh địa chỉ (/documents?arrivalNo=128) — do tìm kiếm toàn cục truyền sang */
  const arrivalNoParam = useSearchParams().get("arrivalNo");

  // Danh mục bộ phận lấy từ API (GET /catalogs/departments)
  const departments = useCatalog(fetchDepartments);

  const [tab, setTab] = useState<DocTab>("den");

  // Bộ lọc — tất cả đều gửi lên máy chủ dưới dạng tham số truy vấn
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [docType, setDocType] = useState("all");
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Drawer chi tiết + form tiếp nhận
  const [selectedNo, setSelectedNo] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  /** Đang xem thùng văn bản đã xoá mềm thay vì sổ đang dùng */
  const [deletedView, setDeletedView] = useState(false);
  /** Văn bản chờ xác nhận xoá — mở drawer nhập lý do */
  const [deleteTarget, setDeleteTarget] = useState<DocumentDetail | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  /**
   * Xoá / khôi phục văn bản yêu cầu quyền `documents:admin` ở backend.
   * Ẩn hẳn nút với vai trò không đủ quyền thay vì để bấm rồi nhận 403.
   */
  const session = useSyncExternalStore(authService.subscribe, authService.getSession, getServerSession);
  const canDelete = findRole(session?.roleKey ?? "")?.modules.documents === "admin";

  const kind = KIND_BY_TAB[tab];

  const list = useApiResource(
    () =>
      listDocuments({
        kind,
        status: status === "all" ? undefined : status,
        department: dept === "all" ? undefined : dept,
        docType: docType === "all" ? undefined : docType,
        from: range.from || undefined,
        to: range.to || undefined,
        deleted: deletedView || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    [kind, status, dept, docType, range.from, range.to, deletedView, page],
  );

  // Số lượng hai sổ để hiển thị trên tab — chỉ lấy tổng, không tải cả danh sách
  const counts = useApiResource(async () => {
    const [incoming, petition] = await Promise.all([
      listDocuments({ kind: "incoming", limit: 1 }),
      listDocuments({ kind: "petition", limit: 1 }),
    ]);
    return { incoming: incoming.total, petition: petition.total };
  }, []);

  const detail = useApiResource<DocumentDetail | null>(
    () => (selectedNo ? getDocument(selectedNo) : Promise.resolve(null)),
    [selectedNo],
  );

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Danh mục loại văn bản có trong dữ liệu đang xem (giữ cả lựa chọn hiện hành) */
  const typeOptions = useMemo(() => {
    const set = new Set((list.data?.items ?? []).map((d) => d.docType));
    if (docType !== "all") set.add(docType);
    return Array.from(set);
  }, [list.data, docType]);

  const changeFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  /**
   * Xuất Excel sổ văn bản theo ĐÚNG bộ lọc đang áp dụng — toàn bộ bản ghi khớp
   * bộ lọc, không chỉ trang đang xem. Máy chủ chặn khi bộ lọc quá rộng và trả
   * thông báo tiếng Việt; hiện nguyên thông báo đó cho cán bộ.
   */
  const exportExcel = async () => {
    setExporting(true);
    try {
      const fileName = await exportDocumentsExcel({
        kind,
        status: status === "all" ? undefined : status,
        department: dept === "all" ? undefined : dept,
        docType: docType === "all" ? undefined : docType,
        from: range.from || undefined,
        to: range.to || undefined,
        deleted: deletedView || undefined,
      });
      showToast(`Đã tải tệp ${fileName}`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const switchTab = (key: string) => {
    setTab(key as DocTab);
    // Danh mục loại khác nhau giữa hai sổ — đưa bộ lọc về mặc định
    setDept("all");
    setStatus("all");
    setDocType("all");
    setPage(1);
  };

  const openDoc = (doc: DocumentDetail) => {
    setSelectedNo(doc.arrivalNo);
    setDrawerOpen(true);
  };

  /*
   * Mở sẵn ngăn chi tiết theo số đến trên thanh địa chỉ. Dùng lại state có sẵn:
   * `detail` tự tải theo `selectedNo`, kể cả khi văn bản đó không nằm trong
   * trang danh sách đang xem.
   *
   * Điều chỉnh state ngay trong render (khuôn mẫu đang dùng ở các drawer) để
   * không thêm lượt render trung gian, và để đóng drawer rồi thì không mở lại.
   */
  const [appliedArrivalNo, setAppliedArrivalNo] = useState<string | null>(null);
  if (arrivalNoParam && arrivalNoParam !== appliedArrivalNo) {
    setAppliedArrivalNo(arrivalNoParam);
    setSelectedNo(arrivalNoParam);
    setDrawerOpen(true);
  }

  /** Đồng bộ bản ghi vừa ghi thành công vào cả drawer lẫn danh sách */
  const applyDoc = (updated: DocumentDetail) => {
    detail.setData(updated);
    list.setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((d) => (d.arrivalNo === updated.arrivalNo ? updated : d)),
          }
        : prev,
    );
  };

  /** Chuyển văn bản sang bộ phận khác — backend tự ghi thêm mốc nhật ký */
  const moveDepartment = async (department: string) => {
    if (!selectedNo) return;
    try {
      applyDoc(await updateDocument(selectedNo, { department }));
      showToast(`Đã chuyển văn bản tới ${department}`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  /** Đính kèm bản scan vừa tải lên vào văn bản đang mở */
  const attachScan = async (scanFileId: string) => {
    if (!selectedNo) return;
    try {
      applyDoc(await updateDocument(selectedNo, { scanFileId }));
      showToast("Đã đính kèm bản scan — có thể chạy OCR bóc tách thông tin");
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  /** Gắn phụ lục / biên bản vào văn bản (khác bản scan gốc dùng cho OCR) */
  const attachFiles = async (fileIds: string[]) => {
    if (!selectedNo) return;
    try {
      applyDoc(await addDocumentAttachments(selectedNo, fileIds));
      showToast(`Đã đính kèm ${fileIds.length} tệp vào văn bản ${selectedNo}`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  const removeFile = async (fileId: string) => {
    if (!selectedNo) return;
    try {
      applyDoc(await removeDocumentAttachment(selectedNo, fileId));
      showToast("Đã gỡ tệp khỏi văn bản");
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  /** Xoá MỀM văn bản khỏi sổ: đặt cờ xoá, số đến và nhật ký vẫn còn */
  const submitDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    try {
      await deleteDocument(target.arrivalNo, deleteReason);
      setDeleteTarget(null);
      setDeleteReason("");
      setDrawerOpen(false);
      list.reload();
      counts.reload();
      showToast(
        `Đã xoá văn bản số đến ${target.arrivalNo}. Dữ liệu vẫn được giữ, khôi phục ở bộ lọc "Đã xoá".`,
      );
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  /** Khôi phục văn bản đã xoá mềm — bản ghi trở lại sổ đang dùng */
  const restore = async () => {
    if (!selectedNo) return;
    try {
      const restored = await restoreDocument(selectedNo);
      setDrawerOpen(false);
      list.reload();
      counts.reload();
      showToast(`Đã khôi phục văn bản số đến ${restored.arrivalNo} vào sổ`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  /** Nút "Chuyển thành công việc" — gọi /workflow/document-to-task */
  const createTaskFromDoc = async (doc: DocumentDetail) => {
    try {
      const { code } = await createTaskFromDocument({ documentId: doc.id });
      showToast(`Đã tạo nhiệm vụ ${code} từ văn bản số đến ${doc.arrivalNo}`);
      detail.reload();
      list.reload();
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  const runOcr = async () => {
    if (!selectedNo) return;
    try {
      const fields = await runDocumentOcr(selectedNo);
      detail.setData((prev) => (prev ? { ...prev, ocrFields: fields } : prev));
      showToast(`Đã bóc tách ${fields.length} trường thông tin từ bản scan`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  const confirmField = async (key: string) => {
    if (!selectedNo) return;
    try {
      const field = await confirmOcrField(selectedNo, key);
      detail.setData((prev) =>
        prev
          ? {
              ...prev,
              ocrFields: prev.ocrFields.map((f) => (f.key === key ? field : f)),
            }
          : prev,
      );
      showToast(`Đã xác nhận trường "${field.label}"`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  const confirmAll = async () => {
    if (!selectedNo) return;
    try {
      const fields = await confirmAllOcr(selectedNo);
      detail.setData((prev) => (prev ? { ...prev, ocrFields: fields } : prev));
      showToast("Đã xác nhận tất cả trường OCR");
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  /** Tiếp nhận văn bản — số đến do máy chủ cấp */
  const receiveDoc = async (values: CreateDocumentInput) => {
    try {
      const created = await createDocument({ ...values, kind: "incoming" });
      setFormOpen(false);
      setTab("den");
      setPage(1);
      list.reload();
      counts.reload();
      showToast(`Đã tiếp nhận văn bản ${created.refNo}, số đến ${created.arrivalNo}`);
    } catch (err) {
      showToast(apiErrorMessage(err));
    }
  };

  return (
    <div className="pg">
      <PageHead
        title="Văn bản và đơn thư"
        sub="Quản lý văn bản đến, đơn thư của công dân và theo dõi luồng chuyển tiếp xử lý"
        actions={
          <>
            <button type="button" className="btn" onClick={() => setAdvancedOpen((v) => !v)}>
              <Icon name="filter" size={15} />
              Bộ lọc nâng cao
            </button>
            {/* Thùng "Đã xoá" là chỗ khôi phục, không phải chỗ vào sổ văn bản mới */}
            {!deletedView && (
              <button type="button" className="btn pri" onClick={() => setFormOpen(true)}>
                <Icon name="plus" size={15} />
                Tiếp nhận văn bản
              </button>
            )}
          </>
        }
      />

      <div style={{ display: "inline-flex", marginBottom: 16 }}>
        <SegmentControl
          options={[
            {
              key: "den",
              label: `Văn bản đến (${counts.data?.incoming ?? 0})`,
            },
            {
              key: "dt",
              label: `Đơn thư công dân (${counts.data?.petition ?? 0})`,
            },
          ]}
          value={tab}
          onChange={switchTab}
        />
        <div style={{ marginLeft: 10 }}>
          <SegmentControl
            options={SCOPE_OPTIONS}
            value={deletedView ? "deleted" : "active"}
            onChange={(key) => changeFilter(() => setDeletedView(key === "deleted"))}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <FilterChips
          chips={departments.map((d) => ({ key: d, label: d }))}
          active={dept}
          onChange={(key) => changeFilter(() => setDept(key))}
          allLabel="Tất cả bộ phận"
        />
        <select className="sel" value={status} onChange={(e) => changeFilter(() => setStatus(e.target.value))}>
          <option value="all">Tất cả trạng thái</option>
          {documentStatuses.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select className="sel" value={docType} onChange={(e) => changeFilter(() => setDocType(e.target.value))}>
          <option value="all">{tab === "den" ? "Tất cả loại văn bản" : "Tất cả loại đơn thư"}</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <DateRangeFilter
          value={range}
          onChange={(next) => changeFilter(() => setRange(next))}
          allLabel="Toàn bộ thời gian"
        />
        <button
          className="btn sm"
          type="button"
          style={{ marginLeft: "auto" }}
          onClick={() => void exportExcel()}
          disabled={exporting}
          title="Xuất toàn bộ văn bản khớp bộ lọc ra tệp Excel"
        >
          <Icon name="file" size={15} />
          {exporting ? "Đang xuất…" : "Xuất Excel"}
        </button>
      </div>

      {advancedOpen && (
        <Card style={{ marginBottom: 16, padding: 16 }}>
          {/* Khung bộ lọc nâng cao — bộ trường cụ thể chờ chốt với khách hàng (câu hỏi mở #7) */}
          <div className="note" style={{ marginBottom: 14 }}>
            <Icon name="alert" size={15} /> Bộ trường lọc nâng cao đang chờ khách hàng xác nhận (câu hỏi mở #7). Khung
            dưới đây là bố cục dự kiến, chưa kích hoạt.
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0 14px",
            }}
          >
            <div className="fgroup">
              <label>Ngày đến từ</label>
              <input className="finp" type="date" disabled />
            </div>
            <div className="fgroup">
              <label>Ngày đến tới</label>
              <input className="finp" type="date" disabled />
            </div>
            <div className="fgroup">
              <label>Cơ quan ban hành</label>
              <input className="finp" placeholder="Chờ định nghĩa trường" disabled />
            </div>
          </div>
        </Card>
      )}

      <Card>
        <DataState
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          empty={items.length === 0}
          emptyMessage={
            deletedView ? "Chưa có văn bản nào bị xoá" : "Không có văn bản nào khớp bộ lọc hiện tại"
          }
        >
          <DocumentTable
            docs={items}
            senderHeader={tab === "den" ? "Cơ quan ban hành" : "Người gửi"}
            onSelect={openDoc}
          />
        </DataState>
      </Card>

      {pageCount > 1 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            justifyContent: "flex-end",
            marginTop: 14,
          }}
        >
          <button className="btn sm" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Trang trước
          </button>
          <span className="tiny muted">
            Trang {page}/{pageCount}
          </span>
          <button className="btn sm" type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Trang sau
          </button>
        </div>
      )}

      <DocumentDrawer
        doc={detail.data}
        loading={detail.loading}
        error={detail.error}
        onRetry={detail.reload}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreateTask={createTaskFromDoc}
        onMoveDepartment={moveDepartment}
        onRunOcr={runOcr}
        onConfirmField={confirmField}
        onConfirmAll={confirmAll}
        onAttachScan={attachScan}
        onAttachFiles={attachFiles}
        onRemoveFile={removeFile}
        onDelete={() => {
          setDeleteReason("");
          setDeleteTarget(detail.data ?? null);
        }}
        onRestore={restore}
        canDelete={canDelete}
      />

      <ReceiveDocForm open={formOpen} onClose={() => setFormOpen(false)} onSubmit={receiveDoc} />

      {/* Drawer xác nhận xoá mềm văn bản */}
      <Drawer
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Xoá văn bản khỏi sổ"
        meta={
          deleteTarget
            ? `Số đến ${deleteTarget.arrivalNo} · ${deleteTarget.refNo} · ${deleteTarget.sender}`
            : undefined
        }
        footer={
          <>
            <button type="button" className="btn danger" onClick={() => void submitDelete()}>
              <Icon name="trash" size={15} />
              Xác nhận xoá
            </button>
            <button
              type="button"
              className="btn"
              style={{ marginLeft: "auto" }}
              onClick={() => setDeleteTarget(null)}
            >
              Huỷ
            </button>
          </>
        }
      >
        <div className="note" style={{ marginBottom: 16 }}>
          {DELETE_NOTE}
        </div>
        {deleteTarget?.linkedTaskCode && (
          <div className="note" style={{ marginBottom: 16, borderColor: "var(--orange)" }}>
            <Icon name="alert" size={15} /> Văn bản này đã sinh ra nhiệm vụ{" "}
            <b>{deleteTarget.linkedTaskCode}</b>. Nhiệm vụ đó KHÔNG bị xoá theo, nhưng khi hoàn thành sẽ
            không còn đồng bộ trạng thái về văn bản nữa.
          </div>
        )}
        <div className="fgroup">
          <label htmlFor="doc-delete-reason">Lý do xoá</label>
          <textarea
            id="doc-delete-reason"
            className="finp"
            value={deleteReason}
            placeholder="Ví dụ: Vào sổ trùng số đến, văn bản gửi sai địa chỉ…"
            onChange={(e) => setDeleteReason(e.target.value)}
          />
          <div className="fhint">
            Không bắt buộc. Lý do được ghi vào nhật ký xử lý của văn bản để truy vết.
          </div>
        </div>
      </Drawer>
    </div>
  );
}
