import { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { EmptyState, Note, SectionHead, SubHeader, tint } from "@/components/common";
import { appConfig } from "@/config/app.config";
import { lookupDossier } from "@/mocks/dossier.mock";
import { zaloService } from "@/services/zalo";
import { useToast } from "@/state/ToastContext";
import type { DossierResult } from "@/types";
import { DossierCard } from "./DossierCard";

/** Số mã tra cứu gần nhất được lưu tối đa */
const HISTORY_MAX = 5;

/** Key localStorage lưu lịch sử tra cứu (mảng JSON, mới nhất trước) */
const HISTORY_KEY = appConfig.storageKeys.lookupHistory;

/** Kích thước nút quét QR cạnh ô nhập (px) */
const QR_BUTTON_SIZE = 46;

/** Đọc lịch sử tra cứu — hỏng dữ liệu / chặn storage thì coi như rỗng */
function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is string => typeof c === "string").slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

function writeHistory(codes: string[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(codes));
  } catch {
    // Bỏ qua: trình duyệt chặn localStorage (chế độ riêng tư) — lịch sử chỉ là tiện ích
  }
}

/**
 * Màn "Tra cứu hồ sơ một cửa" — WBS #15.
 * Nhập hoặc quét QR mã hồ sơ → thông tin hồ sơ + tracker các bước xử lý.
 */
export function LookupPage() {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  /** Mã đã tra gần nhất — rỗng nghĩa là chưa tra lần nào */
  const [searchedCode, setSearchedCode] = useState("");
  const [result, setResult] = useState<DossierResult | undefined>();
  const [history, setHistory] = useState<string[]>(readHistory);

  const saveToHistory = useCallback((saved: string) => {
    setHistory((prev) => {
      const next = [saved, ...prev.filter((c) => c.toLowerCase() !== saved.toLowerCase())].slice(0, HISTORY_MAX);
      writeHistory(next);
      return next;
    });
  }, []);

  const runLookup = useCallback(
    async (rawCode: string) => {
      const trimmed = rawCode.trim();
      if (!trimmed) {
        setError("Vui lòng nhập mã hồ sơ cần tra cứu");
        return;
      }
      setError("");
      setCode(trimmed);
      inputRef.current?.blur();
      setLoading(true);
      const found = await lookupDossier(trimmed);
      setLoading(false);
      setResult(found);
      setSearchedCode(trimmed);
      if (found) saveToHistory(found.code);
    },
    [saveToHistory],
  );

  async function handleScan() {
    if (scanning || loading) return;
    setScanning(true);
    const scanned = await zaloService.scanQrCode();
    setScanning(false);
    if (!scanned) {
      showToast("Không đọc được mã QR, vui lòng thử lại");
      return;
    }
    await runLookup(scanned.toUpperCase());
  }

  function handleClearHistory() {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // Bỏ qua: không đọc/ghi được localStorage
    }
    showToast("Đã xoá lịch sử tra cứu");
  }

  return (
    <div className="app">
      <SubHeader title="Tra cứu hồ sơ" />
      <div className="page plain">
        {/* ----- Ô nhập mã / quét QR ----- */}
        <form
          className="card card-b"
          onSubmit={(e) => {
            e.preventDefault();
            void runLookup(code);
          }}
        >
          <div className="fgroup" style={{ marginBottom: 12 }}>
            <label htmlFor="dossier-code">Mã hồ sơ</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                id="dossier-code"
                ref={inputRef}
                className={`finp ${error ? "err" : ""}`}
                value={code}
                placeholder="VD: HS-2026-04182"
                autoComplete="off"
                autoCapitalize="characters"
                inputMode="text"
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (error) setError("");
                }}
              />
              <button
                type="button"
                onClick={() => void handleScan()}
                disabled={scanning || loading}
                aria-label="Quét mã QR"
                style={{
                  width: QR_BUTTON_SIZE,
                  height: QR_BUTTON_SIZE,
                  flex: "none",
                  borderRadius: 12,
                  background: tint("var(--blue)", 0.13),
                  color: "var(--blue)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {scanning ? <span className="spin dark" /> : <Icon name="qr" size={22} />}
              </button>
            </div>
            {error ? (
              <div className="ferr">{error}</div>
            ) : (
              <div className="fhint">Nhập mã in trên giấy tiếp nhận hoặc quét mã QR trên phiếu hẹn.</div>
            )}
          </div>

          <button type="submit" className="btn pri" disabled={loading || scanning}>
            {loading ? (
              <span className="spin" />
            ) : (
              <>
                <Icon name="search" size={18} />
                Tra cứu
              </>
            )}
          </button>
        </form>

        {/* ----- Kết quả ----- */}
        {searchedCode && result && (
          <div style={{ marginTop: 14 }}>
            <DossierCard result={result} />
          </div>
        )}

        {searchedCode && !result && (
          <div style={{ marginTop: 14 }}>
            <div className="card">
              <EmptyState icon="search" message={`Không tìm thấy hồ sơ mã “${searchedCode}”`} />
            </div>
            <div style={{ marginTop: 12 }}>
              <Note color="var(--orange)" icon="alert">
                Vui lòng kiểm tra lại mã in trên giấy tiếp nhận hồ sơ. Cần hỗ trợ, xin gọi tổng đài{" "}
                <b>{appConfig.hotline}</b>.
              </Note>
            </div>
          </div>
        )}

        {/* ----- Lịch sử tra cứu ----- */}
        {history.length > 0 && (
          <>
            <SectionHead title="Tra cứu gần đây" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {history.map((item) => (
                <button
                  key={item}
                  className="fchip"
                  disabled={loading || scanning}
                  onClick={() => void runLookup(item)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Icon name="history" size={14} color="var(--slate)" />
                  {item}
                </button>
              ))}
            </div>
            <button className="btn sm" onClick={handleClearHistory} style={{ marginTop: 12 }}>
              <Icon name="close" size={15} />
              Xoá lịch sử
            </button>
          </>
        )}
      </div>
    </div>
  );
}
