"use client";

import type { CitizenFeedback } from "@/types";
import { UNASSIGNED, feedbackStatuses, findStatus } from "@/config/status.config";
import { findCategoryIn, useCategoryDirectory } from "@/services/category-directory";
import { slaLabel } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { StarRating } from "@/components/ui/StarRating";
import { Icon } from "@/lib/icons";

/**
 * Chế độ xem Bảng cho phân hệ Phản ánh — cùng khuôn với bảng Nhiệm vụ.
 *
 * VÌ SAO CẦN DẠNG BẢNG bên cạnh dạng thẻ: dạng thẻ tốt để nhìn nhanh ảnh hiện
 * trường, nhưng khi cán bộ phải đối chiếu vài chục phiếu theo hạn xử lý hoặc
 * theo người xử lý thì thẻ bắt cuộn rất dài. Bảng xem được nhiều dòng một lúc
 * và so sánh cùng một cột giữa các phiếu.
 *
 * Số điện thoại KHÔNG hiện ở bảng: API đã che sẵn, và bảng là nơi dễ bị chụp
 * màn hình nhất. Cần liên hệ thì mở ngăn chi tiết.
 */
export function FeedbackTable({
  items,
  onOpen,
}: {
  items: CitizenFeedback[];
  onOpen: (code: string) => void;
}) {
  const categories = useCategoryDirectory();

  return (
    <Card>
      <div className="tw">
        <table className="tb2">
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th style={{ minWidth: 240 }}>Nội dung phản ánh</th>
              <th>Lĩnh vực</th>
              <th style={{ minWidth: 160 }}>Địa điểm</th>
              <th>Người xử lý</th>
              <th>Hạn xử lý</th>
              <th>Đánh giá</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((item) => {
                const status = findStatus(feedbackStatuses, item.status);
                const cat = findCategoryIn(categories, item.categoryLabel);
                const resolved = item.status === "Đã xử lý";
                const sla = slaLabel(item.slaHoursLeft, resolved);
                const unassigned = item.assignee === UNASSIGNED;
                return (
                  <tr
                    key={item.code}
                    className={item.slaHoursLeft < 0 && !resolved ? "late" : ""}
                    onClick={() => onOpen(item.code)}
                  >
                    <td className="tiny muted" style={{ whiteSpace: "nowrap" }}>
                      {item.code}
                      {/* Yêu cầu thu hồi phải thấy ngay trên danh sách, không chỉ
                          trong ngăn chi tiết — nếu không nó nằm im tới lúc người
                          dân gọi lên xã hỏi */}
                      {item.withdrawStatus === "pending" && (
                        <div style={{ marginTop: 4 }}>
                          <Chip color="var(--orange)">Xin thu hồi</Chip>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="tt">{item.title}</div>
                      <div className="tiny muted">{item.sentAt}</div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Chip color={cat.color}>{item.categoryLabel}</Chip>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
                        <Icon name="pin" size={13} />
                        <span className="tiny">{item.location}</span>
                      </div>
                    </td>
                    <td>
                      {unassigned ? (
                        <span className="tiny muted">Chưa phân công</span>
                      ) : (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <Avatar name={item.assignee} />
                          <span className="tiny">{item.assignee}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span className="tiny" style={{ color: sla.color, fontWeight: 600 }}>
                        {sla.text}
                      </span>
                    </td>
                    <td>
                      {/* Chưa đánh giá thì nói rõ, không hiện 0 sao — 0 sao trông
                          như người dân đánh giá kém */}
                      {item.rating > 0 ? (
                        <StarRating value={item.rating} />
                      ) : (
                        <span className="tiny muted">Chưa đánh giá</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Chip color={status.color} tint={status.tint}>
                        {status.label}
                      </Chip>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="tiny muted" style={{ textAlign: "center", padding: 24 }}>
                  Không có phiếu phản ánh phù hợp bộ lọc
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
