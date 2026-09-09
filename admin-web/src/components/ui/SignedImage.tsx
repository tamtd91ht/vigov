"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getSignedUrl } from "@/services/files.service";

/**
 * Ảnh nằm trong kho tệp dùng chung, hiển thị qua link ký sẵn.
 *
 * Route `/files/:id` không nhận header Authorization (thẻ `<img>` không gửi
 * được), nên tệp riêng tư phải xin link `?exp=&sig=` trước. Link ký cũng dùng
 * được cho tệp công khai, nhờ vậy chỗ gọi không cần biết tệp riêng hay chung.
 */
/** Link ký sẵn đang giữ, kèm mã tệp đã sinh ra nó */
interface SignedState {
  fileId: string;
  url: string;
  failed: boolean;
}

const EMPTY_STATE: SignedState = { fileId: "", url: "", failed: false };

export function SignedImage({
  fileId,
  alt,
  zoomable = false,
}: {
  fileId: string;
  alt: string;
  /**
   * Bấm vào ảnh để mở bản đầy đủ ở tab mới.
   *
   * Ô thumbnail dùng `object-fit: contain` nên thấy đủ khung, nhưng ảnh 1600px
   * thu về ô 150px thì mất chi tiết — cán bộ vẫn cần mở bản đầy đủ để đọc biển
   * số, số nhà, mốc giới. Dùng lại link ký sẵn component đang giữ, không xin
   * thêm một lượt nữa.
   */
  zoomable?: boolean;
}) {
  const [state, setState] = useState<SignedState>(EMPTY_STATE);
  const [zoomed, setZoomed] = useState(false);

  // Đổi sang tệp khác → bỏ link cũ ngay trong render, không chờ effect chạy
  if (state.fileId !== fileId) setState({ ...EMPTY_STATE, fileId });

  useEffect(() => {
    let alive = true;
    getSignedUrl(fileId)
      .then((signed) => {
        if (alive) setState({ fileId, url: signed.url, failed: false });
      })
      .catch(() => {
        if (alive) setState({ fileId, url: "", failed: true });
      });
    return () => {
      alive = false;
    };
  }, [fileId]);

  const { url, failed } = state;
  if (failed) return <span className="tiny">Không đọc được ảnh</span>;
  if (!url) return <span className="spinner" style={{ width: 18, height: 18 }} />;

  const image = (
    // Ảnh do người dùng tải lên nằm ở máy chủ API, kích thước không biết trước —
    // next/image không thêm giá trị gì ở đây mà lại cần cấu hình remotePatterns.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} onError={() => setState((prev) => ({ ...prev, failed: true }))} />
  );

  if (!zoomable) return image;

  return (
    <>
      <button type="button" className="imgzoom" title="Bấm để xem ảnh đầy đủ" onClick={() => setZoomed(true)}>
        {image}
      </button>
      {zoomed && <Lightbox url={url} alt={alt} onClose={() => setZoomed(false)} />}
    </>
  );
}

/**
 * Trình xem ảnh đầy đủ — TÔN TRỌNG TỈ LỆ GỐC.
 *
 * VÌ SAO KHÔNG DÙNG `window.open` NHƯ TRƯỚC: mở tab mới phụ thuộc trình chặn
 * cửa sổ bật lên (bấm xong không thấy gì, không báo lỗi), và người xem mất
 * ngữ cảnh phiếu đang mở. Quan trọng hơn, cán bộ cần đối chiếu ảnh với nội dung
 * phiếu — đưa họ sang tab khác là bắt họ nhớ rồi bấm quay lại.
 *
 * Ảnh đặt `max-width/max-height` theo khung nhìn kèm `object-fit: contain`, nên
 * ảnh vuông hiện vuông, ảnh dọc hiện dọc, ảnh nhỏ KHÔNG bị phóng to vỡ hạt
 * (`width/height: auto`). Không có trần chiều rộng cố định nào.
 */
function Lightbox({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // Khoá cuộn nền: cuộn trang phía sau trong lúc xem ảnh làm mất phương hướng
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
    >
      {/* Chặn nổi bọt: bấm vào chính tấm ảnh thì không đóng, chỉ bấm ra nền mới đóng */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} onClick={(e) => e.stopPropagation()} />
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Đóng ảnh">
        ×
      </button>
    </div>,
    document.body,
  );
}
