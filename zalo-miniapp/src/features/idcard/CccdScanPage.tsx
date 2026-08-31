import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Note, SectionHead, SubHeader, tint } from "@/components/common";
import { zaloDiagnostics, zaloService } from "@/services/zalo";
import { useToast } from "@/state/ToastContext";
import { CCCD_FIELD_ORDER, maskCccd, parseCccdQr, type CccdParseResult } from "./cccd";

/**
 * Màn trình diễn cơ chế quét thẻ căn cước — P5-11, tầng 2 (QR).
 *
 * Mục tiêu của màn này là cho thấy CƠ CHẾ, nên nó cố tình phơi ra cả chuỗi thô
 * đọc được lẫn sơ đồ ánh xạ sang từng trường — thứ mà màn nghiệp vụ thật sẽ
 * giấu đi. Có thêm ô dán chuỗi thủ công để kiểm chứng định dạng bằng thẻ thật
 * mà không cần thiết bị quét (câu hỏi còn mở về mẫu Căn cước sau 01/7/2024).
 *
 * Chưa nối vào luồng nghiệp vụ nào: đây là lối vào riêng từ màn Cá nhân.
 */
export function CccdScanPage() {
  const { showToast } = useToast();

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<CccdParseResult | null>(null);
  const [manual, setManual] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [diag, setDiag] = useState<Array<[string, string]> | null>(null);

  async function handleScan() {
    if (scanning) return;
    setScanning(true);
    setScanError(null);
    const { content, error } = await zaloService.scanCccdQr();
    setScanning(false);

    if (!content) {
      // Hiện nguyên văn lỗi của SDK: người thử cầm điện thoại không mở được console
      setScanError(error ?? "Người dùng đã huỷ hoặc không đọc được mã");
      showToast("Chưa quét được — xem chi tiết bên dưới");
      return;
    }
    setResult(parseCccdQr(content));
  }

  async function handleDiagnose() {
    setDiag([["Đang đọc…", ""]]);
    setDiag(await zaloDiagnostics());
  }

  function handleParseManual() {
    if (!manual.trim()) {
      showToast("Chưa có chuỗi nào để phân tích");
      return;
    }
    setResult(parseCccdQr(manual));
  }

  function handleReset() {
    setResult(null);
    setManual("");
  }

  return (
    <div className="app">
      <SubHeader title="Quét thẻ căn cước" />
      <div className="page plain">
        {/* ----- Nói rõ giới hạn TRƯỚC khi người dùng quét ----- */}
        <Note color="var(--orange)" icon="shield">
          Mã QR trên thẻ <b>không được ký số</b>. Cơ chế này chống được lỗi nhập liệu, nhưng{" "}
          <b>không xác minh được thẻ thật hay giả</b>. Muốn xác thực phải đọc chip NFC.
        </Note>

        {/* ----- Nút quét ----- */}
        <button
          className="btn pri"
          style={{ marginTop: 14 }}
          disabled={scanning}
          onClick={() => void handleScan()}
        >
          {scanning ? (
            <span className="spin" />
          ) : (
            <>
              <Icon name="qr" size={18} />
              Quét mã QR trên thẻ
            </>
          )}
        </button>

        {/* ----- Lỗi quét: nói thẳng SDK trả về gì ----- */}
        {scanError && (
          <div className="card card-b" style={{ marginTop: 12, borderLeft: "3px solid var(--orange)" }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--orange)" }}>Không mở được màn quét</div>
            <code style={{ display: "block", fontSize: ".76rem", lineHeight: 1.6, wordBreak: "break-word" }}>
              {scanError}
            </code>
            <button className="btn sm" style={{ marginTop: 10 }} onClick={() => void handleDiagnose()}>
              <Icon name="shield" size={16} />
              Chẩn đoán tích hợp
            </button>
          </div>
        )}

        {/* ----- Bảng chẩn đoán: thay cho console mà điện thoại không có ----- */}
        {diag && (
          <div className="card card-b" style={{ marginTop: 12 }}>
            {diag.map(([label, value]) => (
              <div
                key={label}
                style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line)" }}
              >
                <span style={{ minWidth: 132, fontSize: ".78rem", color: "var(--slate)" }}>{label}</span>
                <code style={{ fontSize: ".76rem", wordBreak: "break-all" }}>{value}</code>
              </div>
            ))}
          </div>
        )}

        {/* ----- Dán chuỗi thủ công: kiểm chứng định dạng không cần thiết bị ----- */}
        <SectionHead title="Hoặc dán chuỗi để thử" />
        <div className="card card-b">
          <div className="fgroup" style={{ marginBottom: 10 }}>
            <textarea
              className="finp"
              rows={3}
              value={manual}
              placeholder="001099012345|123456789|Nguyễn Văn An|01011990|Nam|…|15062021"
              onChange={(e) => setManual(e.target.value)}
              style={{ resize: "vertical", fontFamily: "ui-monospace, monospace", fontSize: ".82rem" }}
            />
            <div className="fhint">
              Dùng để đối chiếu định dạng bằng thẻ thật — gồm cả thẻ Căn cước cấp sau 01/7/2024.
            </div>
          </div>
          <button className="btn sm" onClick={handleParseManual}>
            <Icon name="search" size={16} />
            Phân tích chuỗi
          </button>
        </div>

        {/* ----- Kết quả ----- */}
        {result && (
          <>
            <SectionHead title="Chuỗi thô đọc được" />
            <div className="card card-b">
              <code
                style={{
                  display: "block",
                  fontSize: ".78rem",
                  lineHeight: 1.7,
                  wordBreak: "break-all",
                  color: "var(--slate)",
                }}
              >
                {result.raw}
              </code>
            </div>

            {result.ok ? (
              <>
                <SectionHead title="Kết quả tách trường" />
                <div className="card">
                  {CCCD_FIELD_ORDER.map(({ key, label }, index) => {
                    const value = result.data[key];
                    return (
                      <div
                        key={key}
                        style={{
                          display: "flex",
                          gap: 12,
                          padding: "11px 14px",
                          borderTop: index === 0 ? "none" : "1px solid var(--bd)",
                        }}
                      >
                        <span className="tiny muted" style={{ width: 108, flex: "none" }}>
                          {label}
                        </span>
                        <span style={{ flex: 1, fontWeight: 600, color: "var(--navy)", wordBreak: "break-word" }}>
                          {value || <span className="tiny muted">(trống)</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 12 }}>
                  <Note color="var(--blue)" icon="info">
                    Ghi vào nhật ký dưới dạng che số: <b>{maskCccd(result.data.id)}</b>. Số định danh
                    đầy đủ không xuất hiện trong log ứng dụng.
                  </Note>
                </div>
              </>
            ) : (
              <>
                <SectionHead title="Không đọc được" />
                <div
                  className="card card-b"
                  style={{ background: tint("var(--red)", 0.07), borderColor: tint("var(--red)", 0.3) }}
                >
                  <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
                    {result.errors.map((message) => (
                      <li key={message} style={{ color: "var(--navy)", fontSize: ".9rem", lineHeight: 1.6 }}>
                        {message}
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Note color="var(--orange)" icon="alert">
                    Hệ thống <b>không đoán</b> khi định dạng lệch — gán sai trường còn tệ hơn không
                    đọc được, vì dữ liệu hỏng sẽ được lưu mà không ai phát hiện. Vui lòng nhập tay.
                  </Note>
                </div>
              </>
            )}

            <button className="btn" style={{ marginTop: 14 }} onClick={handleReset}>
              <Icon name="close" size={16} />
              Xoá kết quả
            </button>
          </>
        )}
      </div>
    </div>
  );
}
