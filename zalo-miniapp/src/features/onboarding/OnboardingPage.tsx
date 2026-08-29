import { useState, type CSSProperties } from "react";
import { appConfig } from "@/config/app.config";
import { Icon, type IconName } from "@/components/Icon";
import { Note } from "@/components/common";
import { ApiError } from "@/services/api";
import { OTP_LENGTH, isValidPhone } from "@/services/auth.service";
import { useSession } from "@/state/SessionContext";

/** Lợi ích sau khi định danh — hiển thị ở thẻ trắng */
const BENEFITS: { icon: IconName; text: string }[] = [
  { icon: "megaphone", text: "Gửi phản ánh kèm ảnh hiện trường và vị trí" },
  { icon: "search", text: "Tra cứu tiến độ hồ sơ một cửa của bạn" },
  { icon: "bell", text: "Nhận tin tức, thông báo của xã ngay trên Zalo" },
];

const ERROR_GENERIC = "Không kết nối được máy chủ, vui lòng thử lại.";
const ERROR_PHONE = "Số điện thoại gồm 10 chữ số và bắt đầu bằng 0";
const ERROR_OTP = `Mã xác thực gồm ${OTP_LENGTH} chữ số`;
const OTP_SENT_NOTE = `Mã xác thực gồm ${OTP_LENGTH} chữ số đã được gửi tới số điện thoại của bạn.`;

/**
 * Bước định danh đang hiển thị.
 * "zalo" là đường chính; hai bước "otp-*" là đường thay thế, chỉ mở ra khi
 * đường Zalo không đi được (chạy ngoài ứng dụng Zalo, hoặc backend chưa cấu
 * hình ZALO_APP_SECRET vì khách chưa cấp Zalo OA — câu hỏi mở #3).
 */
type Step = "zalo" | "otp-phone" | "otp-code";

const screenStyle: CSSProperties = {
  minHeight: "100%",
  display: "flex",
  flexDirection: "column",
  background: "linear-gradient(160deg,#16314e,var(--navy))",
  color: "#fff",
  padding: "42px var(--pad) 26px",
};

const logoStyle: CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: 20,
  background: "var(--pink)",
  display: "grid",
  placeItems: "center",
  fontSize: "1.5rem",
  fontWeight: 800,
  letterSpacing: ".5px",
  boxShadow: "0 8px 22px rgba(233,30,140,.35)",
};

const linkBtnStyle: CSSProperties = {
  marginTop: 12,
  width: "100%",
  fontSize: ".8rem",
  fontWeight: 600,
  color: "var(--blue)",
};

export function OnboardingPage() {
  const { identify, requestOtp, verifyOtp } = useSession();
  const [step, setStep] = useState<Step>("zalo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const message = (err: unknown) => (err instanceof ApiError ? err.message : ERROR_GENERIC);

  /**
   * Đường chính: xin token từ Zalo SDK rồi đổi lấy phiên ở backend.
   * Router tự chuyển về "/" khi identified = true nên không cần navigate ở đây.
   */
  async function handleZalo() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await identify();
      if (result.kind === "otp") {
        setStep("otp-phone");
        setNotice(result.reason);
      }
    } catch (err: unknown) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOtp() {
    if (loading) return;
    if (!isValidPhone(phone)) {
      setError(ERROR_PHONE);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await requestOtp(phone);
      setOtp("");
      setStep("otp-code");
      setNotice(OTP_SENT_NOTE);
    } catch (err: unknown) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (loading) return;
    if (otp.length !== OTP_LENGTH) {
      setError(ERROR_OTP);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await verifyOtp(phone, otp);
    } catch (err: unknown) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <div style={screenStyle}>
        {/* Khối thương hiệu */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, paddingBottom: 30 }}>
          <div style={logoStyle}>{appConfig.org.short}</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: ".4px" }}>{appConfig.appName}</div>
            <div style={{ fontSize: ".86rem", color: "rgba(255,255,255,.74)", marginTop: 4 }}>
              {appConfig.appTagline}
            </div>
          </div>
          <div
            style={{
              fontSize: ".76rem",
              color: "rgba(255,255,255,.62)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {appConfig.org.name}
            <br />
            {appConfig.org.parent}
          </div>
        </div>

        {/* Thẻ nội dung định danh */}
        <div className="card card-b" style={{ padding: 18, color: "var(--tx)" }}>
          <h2 style={{ fontSize: "1.06rem" }}>Định danh tài khoản</h2>
          <p className="sm muted" style={{ marginTop: 6 }}>
            {step === "zalo"
              ? "Liên kết số điện thoại Zalo để sử dụng đầy đủ dịch vụ của xã:"
              : "Xác thực số điện thoại để sử dụng đầy đủ dịch vụ của xã:"}
          </p>

          {step === "zalo" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 13, margin: "15px 0 17px" }}>
                {BENEFITS.map((b) => (
                  <div key={b.icon} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                    <Icon name={b.icon} size={19} color="var(--pink)" />
                    <span className="sm" style={{ flex: 1, lineHeight: 1.5 }}>
                      {b.text}
                    </span>
                  </div>
                ))}
              </div>

              <button className="btn pink" onClick={handleZalo} disabled={loading}>
                {loading ? (
                  <>
                    <span className="spin" />
                    Đang liên kết…
                  </>
                ) : (
                  <>
                    <Icon name="phone" size={19} />
                    Liên kết số điện thoại Zalo
                  </>
                )}
              </button>
            </>
          )}

          {step === "otp-phone" && (
            <div style={{ marginTop: 15 }}>
              <div className="fgroup">
                <label htmlFor="otp-phone">
                  Số điện thoại <span className="req">*</span>
                </label>
                <input
                  id="otp-phone"
                  className={`finp ${error ? "err" : ""}`}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Ví dụ: 0987654321"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                />
              </div>
              <button className="btn pink" onClick={handleRequestOtp} disabled={loading}>
                {loading ? (
                  <>
                    <span className="spin" />
                    Đang gửi mã…
                  </>
                ) : (
                  <>
                    <Icon name="send" size={18} />
                    Gửi mã xác thực
                  </>
                )}
              </button>
              <button style={linkBtnStyle} onClick={() => setStep("zalo")} disabled={loading}>
                Thử lại bằng số điện thoại Zalo
              </button>
            </div>
          )}

          {step === "otp-code" && (
            <div style={{ marginTop: 15 }}>
              <div className="fgroup">
                <label htmlFor="otp-code">
                  Mã xác thực gửi tới {phone} <span className="req">*</span>
                </label>
                <input
                  id="otp-code"
                  className={`finp ${error ? "err" : ""}`}
                  type="tel"
                  inputMode="numeric"
                  maxLength={OTP_LENGTH}
                  placeholder={"0".repeat(OTP_LENGTH)}
                  style={{ letterSpacing: "6px", textAlign: "center", fontWeight: 700 }}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
                />
              </div>
              <button className="btn pink" onClick={handleVerifyOtp} disabled={loading}>
                {loading ? (
                  <>
                    <span className="spin" />
                    Đang xác thực…
                  </>
                ) : (
                  <>
                    <Icon name="check" size={18} />
                    Xác nhận
                  </>
                )}
              </button>
              <button
                style={linkBtnStyle}
                onClick={() => {
                  setStep("otp-phone");
                  setError("");
                  setNotice("");
                }}
                disabled={loading}
              >
                Đổi số điện thoại hoặc gửi lại mã
              </button>
            </div>
          )}

          {error && (
            <div className="ferr" style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                <Icon name="alert" size={16} color="var(--red)" />
                <span style={{ flex: 1 }}>{error}</span>
              </div>
            </div>
          )}

          {notice && step !== "zalo" && (
            <div style={{ marginTop: 14 }}>
              <Note icon="info" color="var(--orange)">
                {notice}
              </Note>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <Note icon="shield" color="var(--blue)">
              Số điện thoại chỉ dùng để tiếp nhận và phản hồi phản ánh của bạn.
            </Note>
          </div>
        </div>

        {/* Chân trang: tổng đài hỗ trợ */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: 26,
            textAlign: "center",
            fontSize: ".76rem",
            color: "rgba(255,255,255,.62)",
          }}
        >
          Cần hỗ trợ? Gọi tổng đài{" "}
          <a href={`tel:${appConfig.hotline.replace(/\s/g, "")}`} style={{ color: "#fff", fontWeight: 700 }}>
            {appConfig.hotline}
          </a>
        </div>
      </div>
    </div>
  );
}
