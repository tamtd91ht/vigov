import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { DemoBadge, DemoNote } from "@/components/common";
import { appConfig } from "@/config/app.config";
import { demoConfig } from "@/config/demo.config";
import { useGoBack } from "@/hooks/useGoBack";
import { slaText, type FeedbackCategory } from "@/config/categories";
import { ApiError } from "@/services/api";
import { geoService, usableAddress, type ResolvedLocation } from "@/services/geo.service";
import { zaloService, type LocationResult } from "@/services/zalo";
import { useFeedback } from "@/state/FeedbackContext";
import { useToast } from "@/state/ToastContext";
import type { FeedbackTicket } from "@/types";
import { StepProgress } from "./StepProgress";
import { CategoryStep } from "./CategoryStep";
import { DetailStep, type DetailErrors, type LocationState } from "./DetailStep";
import { ConfirmStep } from "./ConfirmStep";
import { usePickedImages } from "./usePickedImages";
import { ResultView } from "./ResultView";

const TOTAL_STEPS = 3;
/** Độ dài tiêu đề tối thiểu — khớp MIN_TITLE_LENGTH của backend */
const MIN_TITLE_LEN = 5;
const FALLBACK_LOCATION = "Chưa xác định vị trí";
const TOAST_INVALID = "Vui lòng kiểm tra lại thông tin";
const TOAST_SENT = "Đã gửi phản ánh";
const TOAST_FAILED = "Gửi phản ánh không thành công, vui lòng thử lại";
const TOAST_UPLOADING = "Ảnh đang được tải lên, vui lòng đợi giây lát";
const TOAST_IMAGE_FAILED = "Có ảnh chưa tải lên được — bấm “Thử lại” trên ảnh, hoặc xoá ảnh đó";

/**
 * Nhờ máy chủ tra địa chỉ cho vị trí đã có (P3-26).
 *
 * THỨ TỰ ƯU TIÊN — toạ độ của THIẾT BỊ đứng trước mã định vị của Zalo:
 *
 *   · Có toạ độ do thiết bị đo → GET /geo/reverse. Chỉ lấy địa chỉ, GIỮ NGUYÊN
 *     toạ độ. Người dân đang đứng ở hiện trường, nên vị trí đúng là vị trí máy
 *     họ đang cầm đo được.
 *   · Không đo được → POST /geo/zalo-location. Máy chủ cầm ZALO_APP_SECRET đổi
 *     mã lấy toạ độ Zalo tự xác định. Đây là phương án dự phòng, KHÔNG phải
 *     phương án chính: mã của Zalo trả về vị trí do dịch vụ Zalo xác định, có
 *     thể là điểm thô hoặc điểm cũ, không nhất thiết là chỗ thiết bị đang đứng.
 *     Trước đây đường này được ưu tiên và ghi đè lên điểm GPS — chính chỗ đó
 *     làm bản đồ ghim sai.
 *
 * Hỏng thì trả null và giữ nguyên những gì đang có: bản đồ vẫn vẽ được bằng toạ
 * độ của thiết bị, không có lý do gì xoá nó đi chỉ vì máy chủ không trả lời.
 */
async function resolveCoordinates(res: LocationResult): Promise<ResolvedLocation | null> {
  // Bản demo offline không có backend để gọi, mà nhánh mock đã tự có toạ độ
  if (appConfig.api.useMocks) return null;

  try {
    if (res.lat !== undefined && res.lng !== undefined) {
      return await geoService.reverse(res.lat, res.lng);
    }
    if (res.token) {
      // Zalo bắt gửi ĐỒNG THỜI mã định vị và access_token, thiếu một là từ chối
      const accessToken = await zaloService.getAccessToken();
      if (accessToken) return await geoService.resolveZaloLocation(res.token, accessToken);
      console.debug("[geo] có mã định vị nhưng không lấy được access_token Zalo");
    }
  } catch (err: unknown) {
    console.debug("[geo] không hoàn thiện được vị trí", err);
  }
  return null;
}

/** Màn "Gửi phản ánh" 3 bước: Danh mục → Nội dung → Xác nhận (WBS #13) */
export function SendFeedbackPage() {
  const goBack = useGoBack();
  const { create } = useFeedback();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  /* Ảnh được tải lên NGAY khi chọn (xem usePickedImages), nên tới bước gửi chỉ
     còn việc kèm mã tệp — không phải chờ tải trong lúc tạo phiếu. */
  const pickedImages = usePickedImages();
  const [location, setLocation] = useState<LocationState>({ status: "idle", address: "" });
  const [editingAddress, setEditingAddress] = useState(false);
  const [errors, setErrors] = useState<DetailErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<FeedbackTicket | null>(null);
  const [askLeave, setAskLeave] = useState(false);
  const locationAsked = useRef(false);

  /**
   * Xin vị trí một lượt.
   *
   * Địa chỉ người dùng đã tự nhập được GIỮ LẠI khi định vị lại: bấm "Thử định
   * vị lại" mà mất chữ vừa gõ thì không ai bấm lần hai.
   */
  const requestLocation = useCallback(() => {
    setLocation((prev) => ({ ...prev, status: "loading", error: undefined }));
    void (async () => {
      const res = await zaloService.getLocation();
      if (!res.granted) {
        /* Bắt nhập địa chỉ NGAY, đừng để người dùng chờ máy chủ. Nhưng nếu còn
           mã định vị thì vẫn thử đường máy chủ ở dưới: Zalo có thể biết vị trí
           thật, và lúc đó nâng cấp lên granted. */
        setLocation((prev) => ({ status: "denied", address: prev.address, error: res.error, token: res.token }));

        const fromZalo = res.token ? await resolveCoordinates(res) : null;
        if (!fromZalo) return;
        setLocation((prev) => ({
          status: "granted",
          address: prev.address.trim() || usableAddress(fromZalo),
          lat: fromZalo.lat,
          lng: fromZalo.lng,
          source: "zalo",
          token: res.token,
        }));
        return;
      }

      // Toạ độ đã có (navigator.geolocation hoặc bản mock) thì hiện bản đồ NGAY,
      // không chờ máy chủ — mạng di động chậm không được làm treo bước 2.
      setLocation((prev) => ({
        status: "granted",
        address: res.address ?? prev.address,
        lat: res.lat,
        lng: res.lng,
        accuracy: res.accuracy,
        source: res.source,
        token: res.token,
      }));

      const resolved = await resolveCoordinates(res);
      if (!resolved) return;
      setLocation((prev) => ({
        ...prev,
        lat: resolved.lat,
        lng: resolved.lng,
        // Không ghi đè địa chỉ người dùng đã tự gõ
        address: prev.address.trim() || usableAddress(resolved),
      }));
    })();
  }, []);

  /** Vào bước 2 lần đầu thì tự xin quyền vị trí (câu hỏi mở #16 — từ chối thì nhập tay) */
  useEffect(() => {
    if (step !== 2 || locationAsked.current) return;
    locationAsked.current = true;
    requestLocation();
  }, [step, requestLocation]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step, ticket]);

  const dirty =
    category !== null ||
    title.trim() !== "" ||
    description.trim() !== "" ||
    pickedImages.images.length > 0;

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
    /* Không có toạ độ thì địa chỉ chữ là thứ DUY NHẤT chỉ được chỗ xảy ra sự
       việc — bắt buộc phải có. Xét theo toạ độ chứ không theo `status`: có
       trường hợp xin quyền xong mà vẫn không ra toạ độ nào dùng được. */
    const hasPoint = location.lat !== undefined && location.lng !== undefined;
    if (!hasPoint && !location.address.trim()) {
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
      /*
       * Chặn ở đây thay vì ở bước gửi: sang bước 3 rồi mới báo "ảnh chưa xong"
       * thì người dùng phải quay lại một bước để sửa. Ảnh lỗi buộc phải thử lại
       * hoặc xoá — im lặng bỏ ảnh là gửi thiếu bằng chứng mà người gửi không biết.
       */
      if (pickedImages.uploading) {
        showToast(TOAST_UPLOADING);
        return;
      }
      if (pickedImages.hasFailed) {
        showToast(TOAST_IMAGE_FAILED);
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
        // Mã tệp của ảnh đã nằm sẵn trong kho tệp — ảnh được tải lên từ lúc
        // người dùng chọn, không phải lúc bấm gửi.
        imageFileIds: pickedImages.fileIds,
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
            images={pickedImages.images}
            onPickImages={() => void pickedImages.pick()}
            onRetryImage={(key) => void pickedImages.retry(key)}
            onRemoveImage={pickedImages.remove}
            picking={pickedImages.picking}
            location={location}
            onAddressChange={(value) => setLocation((prev) => ({ ...prev, address: value }))}
            editingAddress={editingAddress}
            onToggleEditAddress={() => setEditingAddress((v) => !v)}
            onRetryLocation={requestLocation}
            errors={errors}
          />
        )}

        {step === 3 && category && (
          <ConfirmStep
            category={category}
            title={title}
            description={description}
            images={pickedImages.images}
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
