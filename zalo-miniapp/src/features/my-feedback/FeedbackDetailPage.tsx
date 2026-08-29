import { useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { Icon } from "@/components/Icon";
import {
  Chip,
  Note,
  SectionHead,
  StarRating,
  SubHeader,
  Timeline,
  ticketStatusColors,
  ticketStatusLabels,
} from "@/components/common";
import { DataState } from "@/components/DataState";
import { categoryOf } from "@/config/categories";
import { useApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/services/api";
import { feedbackService } from "@/services/feedback.service";
import { useFeedback } from "@/state/FeedbackContext";
import { useToast } from "@/state/ToastContext";
import type { FeedbackTicket } from "@/types";

/** ===== Hằng số hiển thị ===== */
const PAGE_TITLE = "Chi tiết phản ánh";
const NOT_FOUND_MESSAGE = "Không tìm thấy phiếu";
const LB_DESCRIPTION = "Mô tả";
const LB_IMAGES = "Ảnh hiện trường";
const LB_NO_IMAGE = "Không đính kèm ảnh";
const LB_LOCATION = "Vị trí";
const LB_TIMELINE = "Tiến trình xử lý";
const LB_RATING = "Đánh giá";
const LB_RATING_QUESTION = "Bạn hài lòng với kết quả xử lý ở mức nào?";
const LB_RATING_COMMENT = "Nhận xét (không bắt buộc)";
const LB_RATING_SUBMIT = "Gửi đánh giá";
const LB_RATING_THANKS = "Cảm ơn bạn đã đánh giá";
const MSG_NEED_STARS = "Vui lòng chọn số sao trước khi gửi";
const MSG_RATED = "Đã gửi đánh giá, cảm ơn bạn!";
const MSG_RATE_FAILED = "Không gửi được đánh giá, vui lòng thử lại";
const PROCESSING_NOTE = "Bạn sẽ nhận thông báo Zalo khi phản ánh được xử lý xong";
const COMMENT_PLACEHOLDER = "Chia sẻ thêm về quá trình xử lý của chính quyền…";

const THUMB_SIZE = 84;
const STAR_SIZE_READONLY = 20;
const STAR_SIZE_PICK = 32;

const cardStyle: CSSProperties = { marginTop: 12 };
const chipsStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const codeStyle: CSSProperties = { fontWeight: 700, marginTop: 10 };
const titleStyle: CSSProperties = { fontSize: "1.06rem", margin: "4px 0 6px" };
const blockLabelStyle: CSSProperties = { color: "var(--navy)", fontWeight: 700, marginBottom: 6 };
const descStyle: CSSProperties = { lineHeight: 1.6 };
const locationRowStyle: CSSProperties = { display: "flex", gap: 8, alignItems: "flex-start" };
const starPickStyle: CSSProperties = { display: "flex", justifyContent: "center", padding: "6px 0 14px" };

/**
 * Chi tiết phiếu — GET /feedback/citizen/mine/:code.
 * Luôn tải lại từ máy chủ thay vì đọc bản trong danh sách, vì timeline và
 * trạng thái xử lý thay đổi phía cán bộ trong lúc công dân đang mở app.
 */
export function FeedbackDetailPage() {
  const { code } = useParams<{ code: string }>();

  const resource = useApiResource(
    () =>
      code
        ? feedbackService.detailMine(code)
        : Promise.reject(new ApiError(NOT_FOUND_MESSAGE, 404)),
    [code],
  );

  return (
    <div className="app">
      <SubHeader title={PAGE_TITLE} />
      <div className="page plain">
        <DataState
          loading={resource.loading}
          error={resource.error}
          onRetry={resource.reload}
          empty={!resource.data}
          emptyIcon="alert"
          emptyMessage={NOT_FOUND_MESSAGE}
        >
          {resource.data && <TicketDetail ticket={resource.data} onRated={resource.reload} />}
        </DataState>
      </div>
    </div>
  );
}

function TicketDetail({ ticket, onRated }: { ticket: FeedbackTicket; onRated: () => void }) {
  const { rate } = useFeedback();
  const { showToast } = useToast();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cat = categoryOf(ticket.categoryKey);

  async function submitRating() {
    if (submitting) return;
    if (stars === 0) {
      showToast(MSG_NEED_STARS);
      return;
    }
    setSubmitting(true);
    try {
      await rate(ticket.code, stars, comment);
      showToast(MSG_RATED);
      onRated();
    } catch (err: unknown) {
      showToast(err instanceof ApiError ? err.message : MSG_RATE_FAILED);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Đầu phiếu */}
      <div className="card card-b">
        <div style={chipsStyle}>
          <Chip label={cat.label} color={cat.color} icon={cat.icon} />
          <Chip label={ticketStatusLabels[ticket.status]} color={ticketStatusColors[ticket.status]} />
        </div>
        <div className="tiny muted" style={codeStyle}>
          {ticket.code}
        </div>
        <h3 style={titleStyle}>{ticket.title}</h3>
        <div className="tiny muted">Gửi lúc {ticket.sentAt}</div>
      </div>

      {/* Mô tả */}
      <div className="card card-b" style={cardStyle}>
        <div className="sm" style={blockLabelStyle}>
          {LB_DESCRIPTION}
        </div>
        <div className="sm" style={descStyle}>
          {ticket.description}
        </div>
      </div>

      {/* Ảnh hiện trường — backend trả mã tệp, Phase 1 hiển thị bằng ô màu */}
      <div className="card card-b" style={cardStyle}>
        <div className="sm" style={blockLabelStyle}>
          {LB_IMAGES}
        </div>
        {ticket.imageColors.length === 0 ? (
          <div className="tiny muted">{LB_NO_IMAGE}</div>
        ) : (
          <div className="chips-row">
            {ticket.imageColors.map((color, i) => (
              <div
                key={i}
                className="thumb"
                style={{ width: THUMB_SIZE, height: THUMB_SIZE, background: color }}
              >
                <Icon name="image" size={26} color="rgba(255,255,255,.8)" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vị trí */}
      <div className="card card-b" style={cardStyle}>
        <div className="sm" style={blockLabelStyle}>
          {LB_LOCATION}
        </div>
        <div className="sm" style={locationRowStyle}>
          <Icon name="pin" size={17} color="var(--pink)" />
          <span>{ticket.location}</span>
        </div>
      </div>

      {/* Tiến trình xử lý */}
      <SectionHead title={LB_TIMELINE} />
      <div className="card card-b">
        <Timeline steps={ticket.timeline} />
      </div>

      {/* Đánh giá sau khi đã xử lý xong */}
      {ticket.status === "resolved" && (
        <>
          <SectionHead title={LB_RATING} />
          <div className="card card-b">
            {ticket.rating > 0 ? (
              <>
                <StarRating value={ticket.rating} size={STAR_SIZE_READONLY} />
                {ticket.ratingComment && (
                  <div className="sm" style={{ marginTop: 8, lineHeight: 1.6 }}>
                    {ticket.ratingComment}
                  </div>
                )}
                <div className="tiny muted" style={{ marginTop: 8 }}>
                  {LB_RATING_THANKS}
                </div>
              </>
            ) : (
              <>
                <div className="sm" style={{ textAlign: "center", marginBottom: 4 }}>
                  {LB_RATING_QUESTION}
                </div>
                <div style={starPickStyle}>
                  <StarRating value={stars} size={STAR_SIZE_PICK} onChange={setStars} />
                </div>
                <div className="fgroup">
                  <label htmlFor="rating-comment">{LB_RATING_COMMENT}</label>
                  <textarea
                    id="rating-comment"
                    className="finp"
                    placeholder={COMMENT_PLACEHOLDER}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
                <button className="btn pri" onClick={submitRating} disabled={submitting}>
                  {submitting ? (
                    <>
                      <span className="spin" />
                      Đang gửi…
                    </>
                  ) : (
                    <>
                      <Icon name="send" size={17} />
                      {LB_RATING_SUBMIT}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Thông báo ZNS/push thật triển khai ở P3 #23 */}
      {ticket.status === "processing" && (
        <div style={cardStyle}>
          <Note icon="bell">{PROCESSING_NOTE}</Note>
        </div>
      )}
    </>
  );
}
