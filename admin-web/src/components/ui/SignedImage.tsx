"use client";

import { useEffect, useState } from "react";
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
   * Ô thumbnail dùng `object-fit: cover` nên ảnh dọc của điện thoại bị cắt gần
   * hết — cán bộ phải xem được khung đầy đủ mới đánh giá được hiện trường. Dùng
   * lại link ký sẵn component đang giữ, không xin thêm một lượt nữa.
   */
  zoomable?: boolean;
}) {
  const [state, setState] = useState<SignedState>(EMPTY_STATE);

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
    <button
      type="button"
      className="imgzoom"
      title="Bấm để xem ảnh đầy đủ"
      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
    >
      {image}
    </button>
  );
}
