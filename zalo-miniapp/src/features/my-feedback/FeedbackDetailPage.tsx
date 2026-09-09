import { useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { AttachmentThumb } from "@/features/send-feedback/DetailStep";

/** ===== Hằng số hiển thị ===== */
const PAGE_TITLE = "Chi tiết phản ánh";
const NOT_FOUND_MESSAGE = "Không tìm thấy phiếu";
const LB_DESCRIPTION = "Mô tả";
const LB_IMAGES = "Ảnh hiện trường";
const LB_RESULT_IMAGES = "Ảnh sau xử lý";
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

/** ===== Sửa phiếu & thu hồi ===== */
const LB_EDIT = "Sửa nội dung";
const LB_EDIT_TITLE = "Tiêu đề";
const LB_EDIT_DESC = "Nội dung phản ánh";
const LB_EDIT_SAVE = "Lưu thay đổi";
const LB_EDIT_CANCEL = "Huỷ";
const MSG_EDITED = "Đã cập nhật phản ánh";
const MSG_EDIT_FAILED = "Không lưu được thay đổi, Quý vị vui lòng thử lại";
const MSG_EDIT_EMPTY = "Vui lòng nhập đủ tiêu đề và nội dung";

const LB_WITHDRAW = "Thu hồi phản ánh";
const LB_WITHDRAW_REASON = "Lý do thu hồi (không bắt buộc)";
const WITHDRAW_REASON_PLACEHOLDER = "Ví dụ: sự việc đã được giải quyết…";
const LB_WITHDRAW_CONFIRM_DIRECT = "Gỡ phản ánh";
const LB_WITHDRAW_CONFIRM_REQUEST = "Gửi yêu cầu thu hồi";
const LB_WITHDRAW_BACK = "Để sau";
const MSG_WITHDRAW_REMOVED = "Đã gỡ phản ánh của Quý vị";
const MSG_WITHDRAW_REQUESTED = "Đã gửi yêu cầu thu hồi, chờ cán bộ xác nhận";
const MSG_WITHDRAW_FAILED = "Không gửi được yêu cầu thu hồi, Quý vị vui lòng thử lại";

const HINT_WITHDRAW_DIRECT =
  "Phản ánh chưa có cán bộ tiếp nhận nên Quý vị gỡ được ngay. Sau khi gỡ, phản ánh không còn hiển thị trong danh sách của Quý vị.";
const HINT_WITHDRAW_REQUEST =
  "Phản ánh đã có cán bộ tiếp nhận nên cần cán bộ xác nhận trước khi gỡ. Quý vị gửi yêu cầu, hệ thống sẽ báo lại khi có kết quả.";

const NOTE_WITHDRAW_PENDING =
  "Yêu cầu thu hồi của Quý vị đang được hệ thống xử lý. Phản ánh chỉ được gỡ sau khi cán bộ xác nhận.";
const NOTE_WITHDRAW_REJECTED = "Cán bộ chưa đồng ý thu hồi phản ánh này.";
const LB_WITHDRAW_PENDING_CHIP = "Hệ thống đang xử lý";

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
const noteSubStyle: CSSProperties = { marginTop: 4, lineHeight: 1.5 };
const blockHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};
/** Nút chữ trong thẻ — vùng chạm 44px theo yêu cầu tiếp cận, không chỉ cao bằng chữ */
const linkBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  minHeight: 44,
  padding: "0 4px",
  background: "none",
  border: 0,
  color: "var(--blue)",
  fontWeight: 700,
  fontSize: "0.9rem",
};
const withdrawOpenBtnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  width: "100%",
  minHeight: 48,
  background: "none",
  border: 0,
  color: "var(--red)",
  fontWeight: 700,
};
const fieldStyle: CSSProperties = { marginTop: 4, marginBottom: 10, display: "block" };
const actionRowStyle: CSSProperties = { display: "flex", gap: 8, marginTop: 12 };

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
          {resource.data && (
            <TicketDetail
              ticket={resource.data}
              onRated={resource.reload}
              onChanged={resource.reload}
            />
          )}
        </DataState>
      </div>
    </div>
  );
}

function TicketDetail({
  ticket,
  onRated,
  onChanged,
}: {
  ticket: FeedbackTicket;
  onRated: () => void;
  /** Gọi sau khi sửa nội dung hoặc gửi yêu cầu thu hồi — tải lại phiếu từ máy chủ */
  onChanged: () => void;
}) {
  const { rate } = useFeedback();
  const { showToast } = useToast();
  const navigate = useNavigate();
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

      {/*
        Ghi chú thu hồi — đặt NGAY dưới đầu phiếu, trước cả mô tả.
        Người dân vừa bấm xin thu hồi thì thứ họ tìm đầu tiên khi mở lại phiếu là
        "yêu cầu của mình tới đâu rồi", không phải nội dung họ đã viết.
      */}
      {ticket.withdrawStatus === "pending" && (
        <div style={cardStyle}>
          <Note color="var(--orange)" icon="clock">
            <strong>{LB_WITHDRAW_PENDING_CHIP}</strong>
            <div style={noteSubStyle}>{NOTE_WITHDRAW_PENDING}</div>
            {ticket.withdrawReason && (
              <div className="tiny muted" style={noteSubStyle}>
                Lý do Quý vị đã nêu: {ticket.withdrawReason}
              </div>
            )}
          </Note>
        </div>
      )}
      {ticket.withdrawStatus === "rejected" && (
        <div style={cardStyle}>
          <Note color="var(--red)" icon="alert">
            {NOTE_WITHDRAW_REJECTED}
            {ticket.withdrawDecisionNote && (
              <div className="tiny muted" style={noteSubStyle}>
                Lý do: {ticket.withdrawDecisionNote}
              </div>
            )}
          </Note>
        </div>
      )}

      {/* Mô tả — sửa được khi chưa có cán bộ tiếp nhận */}
      <EditableDescription ticket={ticket} onSaved={onChanged} />

      {/* Thu hồi phản ánh */}
      <WithdrawBlock ticket={ticket} onRequested={onChanged} onRemoved={() => navigate(-1)} />

      {/* Ảnh hiện trường — link đã ký sẵn do máy chủ cấp cùng phiếu */}
      <div className="card card-b" style={cardStyle}>
        <div className="sm" style={blockLabelStyle}>
          {LB_IMAGES}
        </div>
        <ImageRow urls={ticket.imageUrls} />
      </div>

      {/*
        Ảnh nghiệm thu: bằng chứng đã xử lý, do cán bộ chụp. Đây là thứ người
        dân muốn thấy nhất khi phiếu đóng, nên hiện thành khối riêng chứ không
        trộn vào ảnh hiện trường. Chưa có ảnh thì ẩn hẳn khối, đừng để một dòng
        "không có ảnh" ở phiếu còn đang xử lý.
      */}
      {ticket.resultImageUrls.length > 0 && (
        <div className="card card-b" style={cardStyle}>
          <div className="sm" style={blockLabelStyle}>
            {LB_RESULT_IMAGES}
          </div>
          <ImageRow urls={ticket.resultImageUrls} />
        </div>
      )}

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

/**
 * Hàng ảnh của phiếu.
 *
 * Dùng `AttachmentThumb` của màn gửi phản ánh để cùng một cách xử lý ảnh hỏng:
 * link ký sẵn hết hạn sau một giờ, nên người dân mở phiếu để đó rồi cuộn lại
 * có thể gặp ảnh không tải được — lúc đó ô màu kèm icon vẫn tử tế hơn ảnh vỡ.
 */
/**
 * Khối mô tả — chuyển sang chế độ sửa khi phiếu chưa có cán bộ tiếp nhận.
 *
 * Gộp phần XEM và phần SỬA vào một khối thay vì mở màn riêng: người dân sửa
 * chính tả hoặc bổ sung một câu là chuyện vài giây, đẩy sang màn khác rồi quay
 * lại là ba lần chạm cho một việc nhỏ.
 */
function EditableDescription({ ticket, onSaved }: { ticket: FeedbackTicket; onSaved: () => void }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    // Nạp lại từ phiếu: người dân có thể đã sửa dở rồi bấm Huỷ ở lượt trước
    setTitle(ticket.title);
    setDescription(ticket.description);
    setEditing(true);
  }

  async function save() {
    if (saving) return;
    if (!title.trim() || !description.trim()) {
      showToast(MSG_EDIT_EMPTY);
      return;
    }
    setSaving(true);
    try {
      await feedbackService.updateMine(ticket.code, {
        title: title.trim(),
        description: description.trim(),
      });
      showToast(MSG_EDITED);
      setEditing(false);
      onSaved();
    } catch (err: unknown) {
      // Máy chủ là nơi quyết định: cán bộ vừa tiếp nhận trong lúc màn đang mở
      // thì lời gọi trả 409 kèm câu giải thích — hiện nguyên văn cho người dân.
      showToast(err instanceof ApiError ? err.message : MSG_EDIT_FAILED);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="card card-b" style={cardStyle}>
        <div style={blockHeadStyle}>
          <div className="sm" style={blockLabelStyle}>
            {LB_DESCRIPTION}
          </div>
          {ticket.canEdit && (
            <button type="button" style={linkBtnStyle} onClick={startEdit}>
              <Icon name="edit" size={15} color="var(--blue)" />
              <span>{LB_EDIT}</span>
            </button>
          )}
        </div>
        <div className="sm" style={descStyle}>
          {ticket.description}
        </div>
      </div>
    );
  }

  return (
    <div className="card card-b" style={cardStyle}>
      <div className="sm" style={blockLabelStyle}>
        {LB_EDIT}
      </div>

      <label className="tiny muted" htmlFor="edit-title">
        {LB_EDIT_TITLE}
      </label>
      <input
        id="edit-title"
        className="inp"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        style={fieldStyle}
      />

      <label className="tiny muted" htmlFor="edit-desc">
        {LB_EDIT_DESC}
      </label>
      <textarea
        id="edit-desc"
        className="inp"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={5}
        maxLength={5000}
        style={fieldStyle}
      />

      <div style={actionRowStyle}>
        <button type="button" className="btn ghost" onClick={() => setEditing(false)} disabled={saving}>
          {LB_EDIT_CANCEL}
        </button>
        <button type="button" className="btn" onClick={save} disabled={saving}>
          {saving ? <span className="spin" /> : LB_EDIT_SAVE}
        </button>
      </div>
    </div>
  );
}

/**
 * Khối thu hồi phản ánh.
 *
 * Hai đường khác nhau, và giao diện phải nói rõ người dân đang ở đường nào
 * TRƯỚC khi họ bấm: gỡ ngay là việc không hoàn tác được, còn xin duyệt thì phải
 * chờ. Nói sau khi bấm là quá muộn.
 *
 * Ẩn hẳn khối khi: phiếu đã xử lý xong (thu hồi không còn ý nghĩa), hoặc đang
 * có yêu cầu chờ duyệt (ghi chú ở đầu phiếu đã nói rồi).
 */
function WithdrawBlock({
  ticket,
  onRequested,
  onRemoved,
}: {
  ticket: FeedbackTicket;
  onRequested: () => void;
  /** Phiếu đã bị gỡ hẳn — không còn gì để xem, quay về danh sách */
  onRemoved: () => void;
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  if (ticket.status === "resolved" || ticket.withdrawStatus === "pending") return null;

  const direct = ticket.canWithdrawDirectly;

  async function submit() {
    if (sending) return;
    setSending(true);
    try {
      const res = await feedbackService.withdrawMine(ticket.code, reason);
      if (res.removed) {
        showToast(MSG_WITHDRAW_REMOVED);
        onRemoved();
      } else {
        showToast(MSG_WITHDRAW_REQUESTED);
        setOpen(false);
        onRequested();
      }
    } catch (err: unknown) {
      showToast(err instanceof ApiError ? err.message : MSG_WITHDRAW_FAILED);
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <div className="card card-b" style={cardStyle}>
        <button type="button" style={withdrawOpenBtnStyle} onClick={() => setOpen(true)}>
          <Icon name="trash" size={17} color="var(--red)" />
          <span>{LB_WITHDRAW}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="card card-b" style={cardStyle}>
      <div className="sm" style={blockLabelStyle}>
        {LB_WITHDRAW}
      </div>
      <Note color={direct ? "var(--blue)" : "var(--orange)"} icon={direct ? "info" : "clock"}>
        {direct ? HINT_WITHDRAW_DIRECT : HINT_WITHDRAW_REQUEST}
      </Note>

      <label className="tiny muted" htmlFor="withdraw-reason" style={fieldStyle}>
        {LB_WITHDRAW_REASON}
      </label>
      <textarea
        id="withdraw-reason"
        className="inp"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={WITHDRAW_REASON_PLACEHOLDER}
      />

      <div style={actionRowStyle}>
        <button type="button" className="btn ghost" onClick={() => setOpen(false)} disabled={sending}>
          {LB_WITHDRAW_BACK}
        </button>
        <button type="button" className="btn danger" onClick={submit} disabled={sending}>
          {sending ? <span className="spin" /> : direct ? LB_WITHDRAW_CONFIRM_DIRECT : LB_WITHDRAW_CONFIRM_REQUEST}
        </button>
      </div>
    </div>
  );
}

function ImageRow({ urls }: { urls: string[] }) {
  if (urls.length === 0) return <div className="tiny muted">{LB_NO_IMAGE}</div>;
  return (
    <div className="chips-row">
      {urls.map((url, i) => (
        <AttachmentThumb
          key={url}
          uri={url}
          index={i}
          style={{ width: THUMB_SIZE, height: THUMB_SIZE, flex: "0 0 auto" }}
        />
      ))}
    </div>
  );
}
