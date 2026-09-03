import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Nút "quay lại" luôn hoạt động, kể cả khi không có trang nào phía trước.
 *
 * `navigate(-1)` gọi `history.back()` — im lặng không làm gì nếu ngăn xếp
 * lịch sử của webview không còn bậc nào để lùi. Trong Zalo Mini App chuyện đó
 * xảy ra thường: mở app bằng QR/deep link vào thẳng một màn, hoặc vào từ một
 * màn đã `navigate(..., { replace: true })` (như danh sách video liên quan) —
 * lúc đó bấm back không có phản ứng gì, người dùng kẹt lại trong màn đó.
 *
 * react-router lưu chỉ số bậc hiện tại trong `history.state.idx`; `idx === 0`
 * nghĩa là đang ở bậc đầu tiên. Khi đó lùi về `fallback` (màn cha) thay vì
 * gọi `history.back()` vô ích.
 */
export function useGoBack(fallback = "/"): () => void {
  const navigate = useNavigate();

  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
