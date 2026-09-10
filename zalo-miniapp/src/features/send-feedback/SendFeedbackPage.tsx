import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { DemoBadge, DemoNote } from "@/components/common";
import { LocationPrimerDialog } from "@/components/LocationPrimerDialog";
import { demoConfig } from "@/config/demo.config";
import { useGoBack } from "@/hooks/useGoBack";
import { slaText, type FeedbackCategory } from "@/config/categories";
import { ApiError } from "@/services/api";
import { zaloService } from "@/services/zalo";
import { useFeedback } from "@/state/FeedbackContext";
import { useToast } from "@/state/ToastContext";
import type { FeedbackTicket } from "@/types";
import { StepProgress } from "./StepProgress";
import { CategoryStep } from "./CategoryStep";
import { DetailStep, type DetailErrors, type LocationState } from "./DetailStep";
import { ConfirmStep } from "./ConfirmStep";
import { ResultView } from "./ResultView";

const TOTAL_STEPS = 3;
/** Độ dài tiêu đề tối thiểu — khớp MIN_TITLE_LENGTH của backend */
const MIN_TITLE_LEN = 5;
const FALLBACK_LOCATION = "Chưa xác định vị trí";
const TOAST_INVALID = "Vui lòng kiểm tra lại thông tin";
const TOAST_SENT = "Đã gửi phản ánh";
const TOAST_FAILED = "Gửi phản ánh không thành công, vui lòng thử lại";

/** Màn "Gửi phản ánh" 3 bước: Danh mục → Nội dung → Xác nhận (WBS #13) */
export function SendFeedbackPage() {
  const goBack = useGoBack();
  const { create } = useFeedback();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [location, setLocation] = useState<LocationState>({ status: "idle", address: "" });
  const [editingAddress, setEditingAddress] = useState(false);
  const [errors, setErrors] = useState<DetailErrors>({});
  const [submitting, setSubmitting] = useState(false);
  /**
   * Đang ở chặng tải ảnh lên (trước khi tạo phiếu). Tách khỏi `submitting` để
   * nút nói rõ đang làm gì: tải 3 ảnh trên 3G mất vài giây, nếu nút chỉ đứng ở
   * "Đang gửi…" thì người dân dễ tưởng treo rồi tắt app giữa lượt tải.
   */
  const [uploading, setUploading] = useState(false);
  const [ticket, setTicket] = useState<FeedbackTicket | null>(null);
  const [askLeave, setAskLeave] = useState(false);
  /** Đang hiện lời dẫn xin quyền vị trí (trước hộp thoại quyền của hệ thống) */
  const [locationPrimer, setLocationPrimer] = useState(false);
  const locationAsked = useRef(false);

  /**
   * Vào bước 2 lần đầu thì hỏi vị trí — nhưng qua một lời dẫn của ViGov trước.
   *
   * VÌ SAO KHÔNG GỌI THẲNG: `zaloService.getLocation()` kéo theo hộp thoại quyền
   * GỐC của WebView, và hộp thoại đó mang tên miền `h5.zdn.vn` của Zalo chứ
   * không mang tên ViGov — không đổi được. Bật lên đột ngột giữa màn "Gửi phản
   * ánh" thì người dân thấy tên miền lạ và bấm "Từ chối", mất toạ độ hiện trường.
   * Nên hiện `LocationPrimerDialog` trước, giải thích, rồi mới gọi.
   */
  useEffect(() => {
    if (step !== 2 || locationAsked.current) return;
    locationAsked.current = true;
    setLocationPrimer(true);
  }, [step]);

  /** Người dân đã đọc lời dẫn và đồng ý — giờ mới chạm tới hộp thoại quyền của hệ thống */
  function acceptLocation() {
    setLocationPrimer(false);
    setLocation((prev) => ({ ...prev, status: "loading" }));
    void zaloService.getLocation().then((res) => {
      if (res.granted) {
        setLocation({ status: "granted", address: res.address ?? "", lat: res.lat, lng: res.lng });
      } else {
        setLocation({ status: "denied", address: "" });
      }
    });
  }

  /**
   * Người dân chọn tự nhập địa chỉ. Dùng đúng trạng thái `denied` như khi hệ
   * thống từ chối quyền: cùng một hệ quả nghiệp vụ — không có toạ độ, phải nhập
   * tay, và `validateDetail` bắt buộc điền địa chỉ (câu hỏi mở #16).
   */
  function declineLocation() {
    setLocationPrimer(false);
    setLocation({ status: "denied", address: "" });
  }

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step, ticket]);

  const dirty = category !== null || title.trim() !== "" || description.trim() !== "" || images.length > 0;

  function handleBack() {
    if (dirty) setAskLeave(true);
    else goBack();
  }

  function validateDetail(): boolean {
    const next: DetailErrors = {};
    if (!title.trim()) next.title = "Vui lòng nhập tiêu đề phản ánh";
    // Ngưỡng 5 ký tự khớp CreateCitizenFeedbackDto của backend — báo tại chỗ
    // thay vì để máy chủ trả 400 sau khi người dùng đã qua bước xác nhận.
    else if (title.trim().length < MIN_TITLE_LEN) next.title = `Tiêu đề phải có ít nhất ${MIN_TITLE_LEN} ký tự`;
    if (!description.trim()) next.description = "Vui lòng mô tả chi tiết sự việc";
    if (location.status === "denied" && !location.address.trim()) {
      next.address = "Vui lòng nhập địa chỉ nơi xảy ra sự việc";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (step === 1) {
      if (!category) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!validateDetail()) {
        showToast(TOAST_INVALID);
        return;
      }
      setStep(3);
    }
  }

  async function handleSubmit() {
    if (!category || submitting) return;
    setSubmitting(true);
    setUploading(images.length > 0);
    try {
      // Mã phiếu #PA-<năm>-<4 chữ số> do backend sinh khi tạo phiếu.
      const created = await create({
        category,
        title: title.trim(),
        description: description.trim(),
        location: location.address.trim() || FALLBACK_LOCATION,
        lat: location.lat,
        lng: location.lng,
        // Đường dẫn tệp tạm của Zalo; service tải ảnh lên kho tệp trước khi tạo
        // phiếu nên Web Quản trị xem được ảnh hiện trường thật.
        imagePaths: images,
        onImagesUploaded: () => setUploading(false),
      });
      setTicket(created);
      showToast(TOAST_SENT);
    } catch (err: unknown) {
      // Thông báo của máy chủ nói rõ lý do (quá 5 phiếu/ngày, tiêu đề quá ngắn…)
      showToast(err instanceof ApiError ? err.message : TOAST_FAILED);
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  if (ticket) {
    return <ResultView code={ticket.code} sla={category ? slaText(category) : ""} />;
  }

  const nextDisabled = step === 1 && !category;

  return (
    <div className="app">
      {/* Header riêng (không dùng SubHeader) để nút quay lại hỏi xác nhận khi đã nhập liệu */}
      <div className="subhead">
        <button className="back" onClick={handleBack} aria-label="Quay lại">
          <Icon name="back" size={20} />
        </button>
        <h2>Gửi phản ánh</h2>
        <DemoBadge />
        <span className="tiny muted" style={{ fontWeight: 600 }}>
          Bước {step}/{TOTAL_STEPS}
        </span>
      </div>

      <StepProgress current={step} />

      <div className="page plain">
        <DemoNote>{demoConfig.notes.sendFeedback}</DemoNote>
        {step === 1 && <CategoryStep selected={category} onSelect={setCategory} />}

        {step === 2 && (
          <DetailStep
            title={title}
            onTitleChange={setTitle}
            description={description}
            onDescriptionChange={setDescription}
            images={images}
            onImagesChange={setImages}
            location={location}
            onAddressChange={(value) => setLocation((prev) => ({ ...prev, address: value }))}
            editingAddress={editingAddress}
            onToggleEditAddress={() => setEditingAddress((v) => !v)}
            errors={errors}
          />
        )}

        {step === 3 && category && (
          <ConfirmStep
            category={category}
            title={title}
            description={description}
            images={images}
            location={location}
          />
        )}
      </div>

      {/* Thanh nút cố định đáy */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 30,
          background: "#fff",
          borderTop: "1px solid var(--bd)",
          padding: "12px var(--pad)",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
        }}
      >
        <div className="btn-row">
          {step > 1 && (
            <button className="btn" onClick={() => setStep(step - 1)} disabled={submitting}>
              Quay lại
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button className="btn pink" onClick={goNext} disabled={nextDisabled}>
              Tiếp tục
              <Icon name="right" size={17} />
            </button>
          ) : (
            <button className="btn pink" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <span className="spin" />
                  {uploading ? "Đang tải ảnh…" : "Đang gửi…"}
                </>
              ) : (
                <>
                  <Icon name="send" size={17} />
                  Gửi phản ánh
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {locationPrimer && <LocationPrimerDialog onAccept={acceptLocation} onDecline={declineLocation} />}

      {askLeave && (
        <div
          onClick={() => setAskLeave(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(17,24,39,.45)",
            display: "grid",
            placeItems: "center",
            padding: "var(--pad)",
          }}
        >
          <div
            className="card card-b"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 320, textAlign: "center" }}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Icon name="alert" size={30} color="var(--orange)" />
            </div>
            <h3 style={{ margin: "10px 0 6px" }}>Huỷ gửi phản ánh?</h3>
            <p className="sm muted">Nội dung bạn đã nhập sẽ không được lưu lại.</p>
            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => setAskLeave(false)}>
                Tiếp tục nhập
              </button>
              <button className="btn danger" onClick={goBack}>
                Huỷ bỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
