"use client";

import { useState, type FormEvent } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataState } from "@/components/ui/DataState";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { useApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/services/api";
import { ocrProviderLabel } from "@/config/integrations.config";
import { fetchOcrIntegration, saveOcrIntegration } from "@/services/settings.service";

/**
 * Tab "Tích hợp" — chọn nhà cung cấp cho các dịch vụ bên thứ 3.
 *
 * Ba điều giao diện KHÔNG làm, vì làm là sai:
 *  1. Không tự khai danh sách nhà cung cấp — đọc `supportedProviders` từ máy chủ.
 *  2. Không nhận và không hiện khoá API dạng rõ — máy chủ chỉ trả dạng đã che.
 *  3. Không gửi lại khoá cũ để "giữ nguyên" — bỏ trống ô khoá là giữ khoá đang có.
 *
 * Nhà cung cấp có gửi dữ liệu ra ngoài thì hiện cảnh báo ngay tại chỗ chọn:
 * người quyết định phải biết bản scan của cán bộ đi đâu trước khi bấm lưu.
 */
export function IntegrationManager() {
  const { showToast } = useToast();
  const ocr = useApiResource(() => fetchOcrIntegration(), []);

  /**
   * Bản nháp của cán bộ. `null` = chưa sửa gì, khi đó hai ô lấy giá trị đang
   * lưu ở máy chủ.
   *
   * Suy ra từ dữ liệu đã tải thay vì đồng bộ bằng `useEffect`: gọi `setState`
   * trong effect gây render dây chuyền và bị eslint chặn. Sau khi lưu, đặt lại
   * `null` để hai ô tự lấy giá trị mới.
   */
  const [draft, setDraft] = useState<{ provider: string; endpoint: string } | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const provider = draft?.provider ?? ocr.data?.provider ?? "";
  const endpoint = draft?.endpoint ?? ocr.data?.endpoint ?? "";
  const setProvider = (value: string) => setDraft({ provider: value, endpoint });
  const setEndpoint = (value: string) => setDraft({ provider, endpoint: value });

  const info = ocrProviderLabel(provider);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const next = await saveOcrIntegration({
        provider,
        endpoint,
        // Chỉ gửi khoá khi cán bộ thực sự nhập gì đó
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      ocr.setData(() => next);
      // Bỏ bản nháp để hai ô lấy lại giá trị máy chủ vừa trả về
      setDraft(null);
      setApiKey("");
      showToast("Đã lưu cấu hình nhà cung cấp OCR");
    } catch (err: unknown) {
      showToast(err instanceof ApiError ? err.message : "Không lưu được cấu hình. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const xoaKhoa = async () => {
    setSaving(true);
    try {
      const next = await saveOcrIntegration({ apiKey: "" });
      ocr.setData(() => next);
      // Bỏ bản nháp để hai ô lấy lại giá trị máy chủ vừa trả về
      setDraft(null);
      setApiKey("");
      showToast("Đã xoá khoá API đang lưu");
    } catch (err: unknown) {
      showToast(err instanceof ApiError ? err.message : "Không xoá được khoá. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DataState loading={ocr.loading} error={ocr.error} onRetry={ocr.reload}>
      <Card>
        <CardHeader title="Nhận dạng chữ trên bản scan (OCR)" />
        <form onSubmit={submit} style={{ padding: "0 14px 14px" }}>
          <div className="tiny muted" style={{ marginBottom: 14 }}>
            Dùng khi tiếp nhận văn bản đến: máy đọc bản scan và điền hộ các trường để cán bộ rà lại.
          </div>
          <div className="fgroup">
            <label>Nhà cung cấp</label>
            <select
              className="finp"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={saving}
            >
              <option value="">Theo cấu hình máy chủ (biến môi trường)</option>
              {(ocr.data?.supportedProviders ?? []).map((key) => (
                <option key={key} value={key}>
                  {ocrProviderLabel(key).label}
                </option>
              ))}
            </select>
            <div className="fhint">{provider ? info.hint : "Để hệ thống dùng giá trị đã đặt trên máy chủ."}</div>
          </div>

          {provider && info.sendsDataOutside && (
            <div className="fwarn">
              <Icon name="alert" size={13} /> Nhà cung cấp này gửi bản scan ra ngoài hệ thống. Chỉ
              nên dùng với văn bản mẫu hoặc văn bản không chứa thông tin cá nhân của công dân. Mỗi
              lượt quét đều được ghi vào nhật ký hệ thống.
            </div>
          )}

          {provider && info.needsApiKey && (
            <>
              <div className="fgroup" style={{ marginTop: 14 }}>
                <label>Khoá API</label>
                <input
                  className="finp"
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    ocr.data?.hasStoredKey
                      ? "Để trống nếu giữ khoá đang lưu"
                      : "Dán khoá do nhà cung cấp cấp"
                  }
                  disabled={saving}
                />
                <div className="fhint">
                  {ocr.data?.storedKeyUnreadable
                    ? "Khoá đang lưu không đọc được (khoá bảo mật của hệ thống đã thay đổi). Vui lòng nhập lại khoá."
                    : ocr.data?.hasStoredKey
                      ? `Khoá đang lưu: ${ocr.data.apiKeyMasked}. Khoá được mã hoá trước khi lưu và không hiển thị lại đầy đủ.`
                      : "Chưa có khoá nào được lưu. Khoá sẽ được mã hoá trước khi lưu."}
                </div>
              </div>

              <div className="fgroup">
                <label>Điểm cuối riêng</label>
                <input
                  className="finp"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="Để trống để dùng địa chỉ mặc định của nhà cung cấp"
                  disabled={saving}
                />
                <div className="fhint">Chỉ điền khi cơ quan tự dựng máy chủ nhận dạng chữ riêng.</div>
              </div>
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <button className="btn pri" type="submit" disabled={saving}>
              {saving ? "Đang lưu…" : "Lưu cấu hình"}
            </button>
            {ocr.data?.hasStoredKey && (
              <button className="btn danger" type="button" onClick={xoaKhoa} disabled={saving}>
                Xoá khoá đang lưu
              </button>
            )}
          </div>

          <div className="tiny muted" style={{ marginTop: 12 }}>
            {ocr.data?.source === "database"
              ? `Đang dùng cấu hình lưu tại đây${
                  ocr.data.updatedBy ? ` — cập nhật lần cuối bởi ${ocr.data.updatedBy}` : ""
                }.`
              : "Đang dùng cấu hình đặt trên máy chủ. Chọn một nhà cung cấp ở trên để cấu hình tại đây."}
          </div>
        </form>
      </Card>
    </DataState>
  );
}
