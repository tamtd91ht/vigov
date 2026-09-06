"use client";

import { io, type Socket } from "socket.io-client";
import { appConfig } from "@/config/app.config";
import { authService } from "@/services/auth";

/**
 * Kênh thời gian thực (Socket.IO) — nơi DUY NHẤT phía web biết tới socket.
 *
 * Backend chỉ đẩy TÍN HIỆU gọn (`{ type, code, status, at }`), cố tình không gửi
 * bản ghi đầy đủ: quyền xem dữ liệu do máy chủ quyết định, nên client nhận tín
 * hiệu rồi phải TỰ TẢI LẠI qua API của phân hệ. Vì thế các hàm dưới đây không
 * bao giờ dùng payload để vẽ giao diện.
 *
 * TRIẾT LÝ IM LẶNG: realtime chỉ là tiện lợi, không phải điều kiện để dùng được
 * hệ thống. Không nối được (backend chưa bật kênh, proxy chưa chuyển tiếp
 * WebSocket, mạng chặn) thì mọi thứ vẫn chạy như trước — chỉ là phải bấm tải lại
 * bằng tay. Do đó KHÔNG ném lỗi ra giao diện, không bắn toast, không ghi log ồn.
 */

/** Ba sự kiện backend đang phát — khớp REALTIME_EVENTS của backend */
export const REALTIME_EVENTS = {
  feedbackChanged: "feedback.changed",
  taskChanged: "task.changed",
  notificationNew: "notification.new",
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

/** Tín hiệu backend gửi kèm sự kiện — gọn có chủ ý, chỉ dùng để biết "có gì đổi" */
export interface RealtimeSignal {
  /** Loại biến động: created | assigned | resolved | status… (tuỳ phân hệ) */
  type?: string;
  /** Mã bản ghi liên quan (NV-2601, PA-2608, hoặc id thông báo) */
  code?: string;
  status?: string;
  /** Thời điểm phát sinh, ISO 8601 */
  at?: string;
}

/** Số lần thử nối lại trước khi bỏ hẳn — tránh gõ cửa máy chủ vô hạn khi kênh chưa bật */
const RECONNECT_ATTEMPTS = 3;
/** Thời gian chờ bắt tay (ms) */
const CONNECT_TIMEOUT_MS = 8000;

/**
 * Địa chỉ máy chủ realtime, suy ra từ `api.baseUrl` để không khai hai nơi.
 *
 * `baseUrl` có hai dạng:
 *   · tuyệt đối ("http://host:3001/api/v1") → lấy đúng origin của nó
 *   · tương đối ("/api/v1", chạy sau proxy cùng tên miền) → lấy origin trang hiện tại
 *
 * Socket.IO đọc phần đường dẫn của URL là TÊN NAMESPACE (không phải đường dẫn
 * HTTP): kết nối thật vẫn đi qua `/socket.io/`. Reverse proxy vì vậy phải chuyển
 * tiếp `/socket.io/` kèm nâng cấp WebSocket, xem docs/02-ADMIN-WEB.md.
 */
export function realtimeUrl(): string | null {
  const base = appConfig.api.baseUrl;
  let origin = "";
  if (/^https?:\/\//i.test(base)) {
    origin = new URL(base).origin;
  } else if (typeof window !== "undefined") {
    origin = window.location.origin;
  }
  if (!origin) return null;
  return `${origin}${appConfig.realtime.namespace}`;
}

/**
 * Kết nối DÙNG CHUNG cho cả phiên làm việc.
 *
 * VÌ SAO KHÔNG MỞ MỘT SOCKET MỖI MÀN HÌNH: thanh trên cùng (chuông thông báo)
 * luôn hiện, còn trang Nhiệm vụ / Phản ánh cũng lắng nghe — mỗi nơi một socket
 * là 2–3 lần bắt tay và 2–3 phòng trùng nhau trên máy chủ cho cùng một người.
 * Vì vậy giữ MỘT socket, đếm số nơi đang dùng, người cuối rời thì mới ngắt.
 */
let shared: Socket | null = null;
/** Token đã dùng để mở `shared` — đổi token (đăng nhập lại) phải mở kết nối mới */
let sharedToken = "";
let refCount = 0;

/**
 * Xin dùng kênh realtime. Trả về socket dùng chung, hoặc `null` khi chưa đăng
 * nhập / tắt kênh / chạy chế độ mock / đang render phía máy chủ.
 *
 * Mỗi lời gọi thành công PHẢI đi kèm đúng một `releaseRealtime()`.
 */
export function acquireRealtime(): Socket | null {
  if (!appConfig.realtime.enabled) return null;
  // Chế độ mock không có máy chủ nào để nối
  if (appConfig.api.useMocks) return null;

  const token = authService.getAccessToken();
  if (!token) return null;

  const url = realtimeUrl();
  if (!url) return null;

  // Token đổi (đăng xuất rồi đăng nhập lại) thì kết nối cũ mang danh tính cũ
  if (shared && sharedToken !== token) {
    shared.removeAllListeners();
    shared.disconnect();
    shared = null;
    refCount = 0;
  }

  if (!shared) {
    shared = io(url, {
      // Backend xác thực qua handshake.auth.token bằng chính JWT của hệ thống
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: RECONNECT_ATTEMPTS,
      timeout: CONNECT_TIMEOUT_MS,
    });
    sharedToken = token;

    /*
     * Lỗi kết nối là trạng thái BÌNH THƯỜNG khi backend chưa bật kênh realtime
     * hoặc proxy chưa chuyển tiếp WebSocket. Nuốt tại đây để socket.io không ném
     * lỗi ra ngoài — giao diện phải im lặng, xem chú thích đầu tệp.
     */
    shared.on("connect_error", () => {});
    // Backend gửi sự kiện này rồi ngắt khi token sai/hết hạn — không cần báo gì thêm
    shared.on("auth.error", () => {});
  }

  refCount += 1;
  return shared;
}

/** Trả lại kênh realtime; nơi dùng cuối cùng rời thì ngắt kết nối hẳn */
export function releaseRealtime(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && shared) {
    shared.removeAllListeners();
    shared.disconnect();
    shared = null;
    sharedToken = "";
  }
}
