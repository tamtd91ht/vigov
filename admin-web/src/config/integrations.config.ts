/**
 * Nhãn hiển thị của nhà cung cấp bên thứ 3.
 *
 * DANH SÁCH nhà cung cấp dùng được do MÁY CHỦ trả về (`supportedProviders`) —
 * tệp này chỉ dịch mã sang tên tiếng Việt và câu mô tả. Nhờ vậy máy chủ thêm
 * nhà cung cấp mà giao diện chưa kịp cập nhật thì vẫn chọn được (hiện mã gốc),
 * còn giao diện không bao giờ cho chọn thứ máy chủ chưa hỗ trợ.
 */

export interface ProviderLabel {
  label: string;
  /** Một câu nói rõ nhà cung cấp này làm gì và dữ liệu đi đâu */
  hint: string;
  /** Nhà cung cấp có gửi dữ liệu ra ngoài hệ thống hay không */
  sendsDataOutside: boolean;
  /** Có cần khoá API hay không — dùng để bật/tắt ô nhập khoá */
  needsApiKey: boolean;
}

export const ocrProviderLabels: Record<string, ProviderLabel> = {
  mock: {
    label: "Giả lập (không gọi dịch vụ ngoài)",
    hint: "Trả về dữ liệu mẫu cố định cho mọi bản scan. Dùng để chạy thử giao diện, không đọc chữ thật.",
    sendsDataOutside: false,
    needsApiKey: false,
  },
  ocrspace: {
    label: "ocr.space (miễn phí, máy chủ nước ngoài)",
    hint: "Đọc chữ thật. Bản scan được gửi ra máy chủ nước ngoài để xử lý, nên chỉ dùng với văn bản mẫu hoặc văn bản không chứa thông tin cá nhân của công dân. Giới hạn: mỗi tệp tối đa 1MB, PDF tối đa 3 trang.",
    sendsDataOutside: true,
    needsApiKey: true,
  },
};

/** Nhãn cho một mã nhà cung cấp; chưa biết mã thì hiện chính mã đó */
export function ocrProviderLabel(key: string): ProviderLabel {
  return (
    ocrProviderLabels[key] ?? {
      label: key,
      hint: "Nhà cung cấp này chưa có mô tả trong giao diện.",
      sendsDataOutside: true,
      needsApiKey: true,
    }
  );
}
