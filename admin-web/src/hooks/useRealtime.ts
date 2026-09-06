"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { authService, getServerSession } from "@/services/auth";
import {
  acquireRealtime,
  releaseRealtime,
  type RealtimeEventName,
  type RealtimeSignal,
} from "@/services/realtime.service";

/** Bảng sự kiện → việc cần làm khi nhận tín hiệu */
export type RealtimeHandlers = Partial<Record<RealtimeEventName, (signal: RealtimeSignal) => void>>;

/**
 * Lắng nghe kênh thời gian thực trong vòng đời của một màn hình.
 *
 * Tự nối khi đã có phiên đăng nhập, tự ngắt khi rời màn hình hoặc khi đăng xuất
 * (đổi `accessToken` là dựng lại kết nối với token mới).
 *
 * Backend chỉ gửi tín hiệu gọn nên các hàm xử lý ở đây gần như luôn là
 * `list.reload()` — tải lại bằng chính API của phân hệ, không vẽ từ payload.
 *
 * VÌ SAO GIỮ HANDLER TRONG REF: trang truyền hàm mũi tên mới ở mỗi lần render.
 * Nếu đưa thẳng vào danh sách phụ thuộc của effect thì mỗi lần render là một lần
 * mở lại socket — vừa nặng vừa làm mất sự kiện giữa hai lần nối.
 */
export function useRealtime(handlers: RealtimeHandlers): void {
  const session = useSyncExternalStore(authService.subscribe, authService.getSession, getServerSession);
  const token = session?.accessToken ?? "";

  /*
   * Bản mới nhất của bảng xử lý, cập nhật trong effect (KHÔNG gán trong thân
   * render — React cấm ghi ref lúc render).
   * Effect này khai báo TRƯỚC effect mở kết nối nên luôn chạy trước ở mỗi lượt.
   */
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!token) return;

    const socket = acquireRealtime();
    if (!socket) return;

    /*
     * Socket dùng chung nhiều màn hình nên chỉ gỡ ĐÚNG các listener của mình khi
     * rời màn hình — `removeAllListeners()` sẽ cắt luôn tai nghe của chuông
     * thông báo ở thanh trên cùng.
     */
    const names = Object.keys(handlersRef.current) as RealtimeEventName[];
    const bound = names.map((name) => {
      const listener = (signal: RealtimeSignal) => handlersRef.current[name]?.(signal);
      socket.on(name, listener);
      return { name, listener };
    });

    return () => {
      for (const { name, listener } of bound) socket.off(name, listener);
      releaseRealtime();
    };
    // Chỉ token quyết định việc mở/đóng kết nối; danh sách sự kiện cố định theo màn hình
  }, [token]);
}
