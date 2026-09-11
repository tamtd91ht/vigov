"use client";

import type { CitizenFeedback } from "@/types";
import { UNASSIGNED, feedbackStatuses } from "@/config/status.config";
import { findCategoryIn, useCategoryDirectory } from "@/services/category-directory";
import { slaLabel } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/lib/icons";

/**
 * Bảng Kanban phân hệ Phản ánh — ba cột theo `feedbackStatuses`.
 *
 * Cùng khuôn với Kanban Nhiệm vụ: cột lặp từ mảng cấu hình trạng thái, không
 * viết cứng từng cột. Thêm hoặc đổi tên một trạng thái thì sửa
 * `status.config.ts`, Kanban tự đổi theo.
 *
 * Kéo–thả đổi trạng thái CHƯA làm: đổi trạng thái phiếu phản ánh là hành động
 * nghiệp vụ có ghi vết và có điều kiện (phân công trước khi xử lý, phải có ảnh
 * nghiệm thu trước khi đóng), nên phải đi qua ngăn chi tiết chứ không thể chỉ
 * kéo một cái thẻ.
 */
function FeedbackKanbanCard({
  item,
  onOpen,
}: {
  item: CitizenFeedback;
  onOpen: (code: string) => void;
}) {
  const categories = useCategoryDirectory();
  const cat = findCategoryIn(categories, item.categoryLabel);
  const resolved = item.status === "Đã xử lý";
  const sla = slaLabel(item.slaHoursLeft, resolved);
  const unassigned = item.assignee === UNASSIGNED;

  return (
    <div className="tk" onClick={() => onOpen(item.code)} role="button">
      {/* Thanh màu trên đầu thẻ theo lĩnh vực phản ánh */}
      <div className="top" style={{ background: cat.color }} />
      <div className="in">
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span className="tiny muted">{item.code}</span>
          {item.withdrawStatus === "pending" && (
            <Chip color="var(--orange)">Xin thu hồi</Chip>
          )}
        </div>
        <div className="ti">{item.title}</div>
        <div className="src" style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
          <Icon name="pin" size={12} />
          {item.location}
        </div>
        <div
          className="tiny"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 10,
          }}
        >
          <Chip color={cat.color}>{item.categoryLabel}</Chip>
          <span style={{ color: sla.color, fontWeight: 600 }}>{sla.text}</span>
        </div>
        <div className="ft">
          {unassigned ? (
            <span className="tiny muted">Chưa phân công</span>
          ) : (
            <>
              <Avatar name={item.assignee} />
              <span
                className="tiny muted"
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.assignee}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function FeedbackKanban({
  items,
  onOpen,
}: {
  items: CitizenFeedback[];
  onOpen: (code: string) => void;
}) {
  return (
    <div className="kb">
      {feedbackStatuses.map((st) => {
        const column = items.filter((item) => item.status === st.key);
        return (
          <div className="kbc" key={st.key}>
            <div className="kbc-h">
              <span className="dot" style={{ background: st.color }} />
              {st.label}
              <span className="n">{column.length}</span>
            </div>
            {column.length ? (
              column.map((item) => (
                <FeedbackKanbanCard key={item.code} item={item} onOpen={onOpen} />
              ))
            ) : (
              <div className="tiny muted" style={{ padding: "14px 6px", textAlign: "center" }}>
                Không có phiếu nào
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
