"use client";

import { useMemo, useState } from "react";
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
import { useCatalog } from "@/hooks/useCatalog";
import {
  apiErrorMessage,
  confirmAllOcr,
  confirmOcrField,
  createDocument,
  createTaskFromDocument,
  getDocument,
  listDocuments,
  runDocumentOcr,
  updateDocument,
  type CreateDocumentInput,
  type DocumentDetail,
  type DocumentKind,
} from "@/services/documents.service";
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

export function DocumentsPage() {
  const { showToast } = useToast();

  // Danh mục bộ phận lấy từ API (GET /catalogs/departments)
  const departments = useCatalog(fetchDepartments);

  const [tab, setTab] = useState<DocTab>("den");

  // Bộ lọc — tất cả đều gửi lên máy chủ dưới dạng tham số truy vấn
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [docType, setDocType] = useState("all");
  const [page, setPage] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Drawer chi tiết + form tiếp nhận
  const [selectedNo, setSelectedNo] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const kind = KIND_BY_TAB[tab];

  const list = useApiResource(
    () =>
      listDocuments({
        kind,
        status: status === "all" ? undefined : status,
        department: dept === "all" ? undefined : dept,
        docType: docType === "all" ? undefined : docType,
        page,
        limit: PAGE_SIZE,
      }),
    [kind, status, dept, docType, page],
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
            <button type="button" className="btn pri" onClick={() => setFormOpen(true)}>
              <Icon name="plus" size={15} />
              Tiếp nhận văn bản
            </button>
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
          emptyMessage="Không có văn bản nào khớp bộ lọc hiện tại"
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
      />

      <ReceiveDocForm open={formOpen} onClose={() => setFormOpen(false)} onSubmit={receiveDoc} />
    </div>
  );
}
