"use client";

import type { IncomingDocument } from "@/types";
import type { DocumentDetail } from "@/services/documents.service";
import { Chip } from "@/components/ui/Chip";
import { documentStatuses, urgencyLevels, confidentialityLevels, findStatus } from "@/config/status.config";
import { deadlineLabel } from "@/lib/format";

const NORMAL_LEVEL_KEY = "Thường";

/** Chip độ khẩn / độ mật — chỉ hiển thị khi khác mức "Thường" */
function LevelChips({ doc }: { doc: IncomingDocument }) {
  const urgency = doc.urgency !== NORMAL_LEVEL_KEY ? findStatus(urgencyLevels, doc.urgency) : null;
  const confidentiality =
    doc.confidentiality !== NORMAL_LEVEL_KEY ? findStatus(confidentialityLevels, doc.confidentiality) : null;
  if (!urgency && !confidentiality) return <span className="muted">—</span>;
  return (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
      {urgency && (
        <Chip color={urgency.color} tint={urgency.tint}>
          {urgency.label}
        </Chip>
      )}
      {confidentiality && (
        <Chip color={confidentiality.color} tint={confidentiality.tint}>
          {confidentiality.label}
        </Chip>
      )}
    </span>
  );
}

export function DocumentTable({
  docs,
  senderHeader,
  onSelect,
}: {
  docs: DocumentDetail[];
  /** Nhãn cột nguồn: "Cơ quan ban hành" (văn bản đến) / "Người gửi" (đơn thư) */
  senderHeader: string;
  onSelect: (doc: DocumentDetail) => void;
}) {
  return (
    <div className="tw">
      <table className="tb2">
        <thead>
          <tr>
            <th>Số đến</th>
            <th>Số/Ký hiệu</th>
            <th>Ngày đến</th>
            <th>{senderHeader}</th>
            <th>Trích yếu</th>
            <th>Bộ phận đang giữ</th>
            <th>Hạn xử lý</th>
            <th>Khẩn/Mật</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {docs.length === 0 && (
            <tr style={{ cursor: "default" }}>
              <td colSpan={9} className="muted" style={{ textAlign: "center", padding: 26 }}>
                Không có văn bản nào khớp bộ lọc hiện tại
              </td>
            </tr>
          )}
          {docs.map((doc) => {
            const status = findStatus(documentStatuses, doc.status);
            const hasDeadline = doc.deadline !== "";
            const due = deadlineLabel(doc.daysLeft);
            return (
              <tr key={doc.arrivalNo} className={hasDeadline && due.late ? "late" : ""} onClick={() => onSelect(doc)}>
                <td>
                  <b style={{ color: "var(--navy)" }}>{doc.arrivalNo}</b>
                </td>
                <td>
                  <span className="tt">{doc.refNo}</span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>{doc.date}</td>
                <td>{doc.sender}</td>
                <td style={{ minWidth: 260 }}>
                  <div
                    style={{
                      maxWidth: 340,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                    title={doc.summary}
                  >
                    {doc.summary}
                  </div>
                </td>
                <td>{doc.department}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {hasDeadline ? (
                    <>
                      {doc.deadline}
                      <div
                        className="tiny"
                        style={{
                          marginTop: 2,
                          color: due.color,
                          fontWeight: 700,
                        }}
                      >
                        {due.text}
                      </div>
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <LevelChips doc={doc} />
                </td>
                <td>
                  <Chip color={status.color} tint={status.tint} dot>
                    {status.label}
                  </Chip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
