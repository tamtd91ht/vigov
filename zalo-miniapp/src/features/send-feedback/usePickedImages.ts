import { useCallback, useState } from "react";
import { appConfig } from "@/config/app.config";
import { ApiError } from "@/services/api";
import { uploadFeedbackImage } from "@/services/files.service";
import { zaloService } from "@/services/zalo";

/**
 * Ảnh hiện trường trong lúc soạn phiếu.
 *
 * Ảnh được tải lên NGAY khi người dùng chọn, chứ không dồn tới lúc bấm gửi.
 * Hai lý do:
 *   · Người dân biết ngay ảnh nào không gửi được và thử lại đúng ảnh đó, thay
 *     vì cả phiếu trượt ở bước cuối sau khi đã gõ xong mọi thứ.
 *   · Đường dẫn Zalo trả về là tệp TẠM của webview; đọc muộn thì có máy đã dọn
 *     mất tệp, mà lỗi đó chỉ xuất hiện trên thiết bị thật.
 */
export interface PickedImage {
  /** Khoá bền trong danh sách — hai lần chọn có thể ra cùng một đường dẫn */
  key: string;
  /** Đường dẫn tạm của Zalo, dùng để xem trước tại chỗ */
  uri: string;
  /** Mã tệp trong kho tệp dùng chung; chỉ có khi đã tải lên xong */
  fileId?: string;
  status: "uploading" | "done" | "error";
  /** Lý do tải lên thất bại, hiện ngay trên ô ảnh */
  error?: string;
}

const UPLOAD_FAILED = "Không tải được ảnh lên máy chủ";

/** Sinh khoá duy nhất cho một ô ảnh */
let imageSeq = 0;
function nextKey(): string {
  imageSeq += 1;
  return `img-${imageSeq}`;
}

export interface PickedImagesValue {
  images: PickedImage[];
  /** Đang mở trình chọn ảnh của Zalo */
  picking: boolean;
  /** Còn ảnh đang tải lên — chưa cho sang bước xác nhận */
  uploading: boolean;
  /** Có ảnh tải lên thất bại — buộc thử lại hoặc xoá trước khi gửi */
  hasFailed: boolean;
  /** Mã tệp của những ảnh đã tải lên xong, để gửi kèm phiếu */
  fileIds: string[];
  pick: () => Promise<void>;
  retry: (key: string) => Promise<void>;
  remove: (key: string) => void;
}

export function usePickedImages(): PickedImagesValue {
  const [images, setImages] = useState<PickedImage[]>([]);
  const [picking, setPicking] = useState(false);

  /** Cập nhật một ô ảnh theo khoá; ô đã bị xoá thì bỏ qua */
  const patch = useCallback((key: string, next: Partial<PickedImage>) => {
    setImages((prev) => prev.map((img) => (img.key === key ? { ...img, ...next } : img)));
  }, []);

  const upload = useCallback(
    async (key: string, uri: string) => {
      try {
        const fileId = await uploadFeedbackImage(uri);
        patch(key, { status: "done", fileId, error: undefined });
      } catch (err: unknown) {
        patch(key, {
          status: "error",
          error: err instanceof ApiError ? err.message : UPLOAD_FAILED,
        });
      }
    },
    [patch],
  );

  /**
   * Mở trình chọn ảnh rồi tải song song những ảnh vừa chọn.
   *
   * Số lượng xin đúng bằng số ô còn trống; `slice` cắt lại vì trình chọn của
   * Zalo có thể trả nhiều hơn `count`.
   */
  const pick = useCallback(async () => {
    setPicking(true);
    let picked: string[] = [];
    try {
      // Đọc số ô còn trống ngay trước khi mở trình chọn, không dùng biến cũ
      const room = appConfig.maxFeedbackImages - images.length;
      if (room <= 0) return;
      picked = (await zaloService.chooseImage(room)).slice(0, room);
    } finally {
      setPicking(false);
    }
    if (picked.length === 0) return;

    const added = picked.map<PickedImage>((uri) => ({ key: nextKey(), uri, status: "uploading" }));
    setImages((prev) => [...prev, ...added]);
    await Promise.all(added.map((img) => upload(img.key, img.uri)));
  }, [images.length, upload]);

  const retry = useCallback(
    async (key: string) => {
      const target = images.find((img) => img.key === key);
      if (!target) return;
      patch(key, { status: "uploading", error: undefined });
      await upload(key, target.uri);
    },
    [images, patch, upload],
  );

  const remove = useCallback((key: string) => {
    /*
     * Chỉ bỏ ảnh khỏi phiếu đang soạn, KHÔNG xoá tệp trên máy chủ: công dân
     * không có quyền xoá trong kho tệp, và tệp không được phiếu nào tham chiếu
     * thì thuộc việc dọn định kỳ của quản trị.
     */
    setImages((prev) => prev.filter((img) => img.key !== key));
  }, []);

  return {
    images,
    picking,
    uploading: images.some((img) => img.status === "uploading"),
    hasFailed: images.some((img) => img.status === "error"),
    fileIds: images.filter((img) => img.status === "done" && img.fileId).map((img) => img.fileId as string),
    pick,
    retry,
    remove,
  };
}
