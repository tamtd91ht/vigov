import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { DemoBadge, DemoNote } from "@/components/common";
import { appConfig } from "@/config/app.config";
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
  const [ticket, setTicket] = useState<FeedbackTicket | null>(null);
  const [askLeave, setAskLeave] = useState(false);
  const locationAsked = useRef(false);

  /** Vào bước 2 lần đầu thì tự xin quyền vị trí (câu hỏi mở #16 — từ chối thì nhập tay) */
  useEffect(() => {
    if (step !== 2 || locationAsked.current) return;
    locationAsked.current = true;
    setLocation((prev) => ({ ...prev, status: "loading" }));
    let alive = true;
    void zaloService.getLocation().then((res) => {
      if (!alive) return;
      if (res.granted) {
        setLocation({ status: "granted", address: res.address ?? "", lat: res.lat, lng: res.lng });
      } else {
        setLocation({ status: "denied", address: "" });
      }
    });
    return () => {
      alive = false;
    };
  }, [step]);

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
    try {
      // Mã phiếu #PA-<năm>-<4 chữ số> do backend sinh khi tạo phiếu.
      const created = await create({
        category,
        title: title.trim(),
        description: description.trim(),
        location: location.address.trim() || FALLBACK_LOCATION,
        lat: location.lat,
        lng: location.lng,
        // Đường dẫn ảnh của Zalo chỉ sống trong lúc soạn phiếu: là tệp tạm của
        // webview, không gửi được lên máy chủ (module Files chưa mở cho Mini
        // App — WBS #24) và hết hiệu lực khi mở lại app. Nên phiếu đã gửi giữ
        // đúng SỐ ảnh dưới dạng ô màu, khớp cách backend trả về imageFileIds.
        imageColors: images.map(
          (_, i) => appConfig.imagePlaceholderColors[i % appConfig.imagePlaceholderColors.length],
        ),
      });
      setTicket(created);
      showToast(TOAST_SENT);
    } catch (err: unknown) {
      // Thông báo của máy chủ nói rõ lý do (quá 5 phiếu/ngày, tiêu đề quá ngắn…)
      showToast(err instanceof ApiError ? err.message : TOAST_FAILED);
    } finally {
      setSubmitting(false);
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
                  Đang gửi…
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
