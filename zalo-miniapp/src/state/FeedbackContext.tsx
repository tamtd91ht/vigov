import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError } from "@/services/api";
import { feedbackService, type CreateFeedbackInput } from "@/services/feedback.service";
import { useSession } from "@/state/SessionContext";
import type { FeedbackTicket } from "@/types";

interface FeedbackValue {
  tickets: FeedbackTicket[];
  loading: boolean;
  error: string | null;
  /** Tải lại danh sách từ máy chủ */
  reload: () => void;
  byCode: (code: string) => FeedbackTicket | undefined;
  create: (input: CreateFeedbackInput) => Promise<FeedbackTicket>;
  rate: (code: string, stars: number, comment: string) => Promise<void>;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

const LOAD_ERROR = "Không tải được danh sách phản ánh";

/**
 * Danh sách phản ánh của công dân đang đăng nhập.
 *
 * Provider chỉ gọi API khi đã có phiên — chưa định danh thì
 * /feedback/citizen/mine trả 401/403, gọi trước chỉ tạo lỗi vô ích ở màn
 * onboarding. Định danh xong, `identified` đổi giá trị và danh sách tự tải.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { identified } = useSession();
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!identified) {
      setTickets([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await feedbackService.listMine();
        if (!cancelled) setTickets(items);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : LOAD_ERROR);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [identified, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const byCode = useCallback((code: string) => tickets.find((t) => t.code === code), [tickets]);

  const create = useCallback(async (input: CreateFeedbackInput) => {
    const ticket = await feedbackService.create(input);
    // Thêm ngay vào đầu danh sách để Trang chủ / Phản ánh của tôi hiển thị liền,
    // không phải chờ một vòng gọi lại API.
    setTickets((prev) => [ticket, ...prev.filter((t) => t.code !== ticket.code)]);
    return ticket;
  }, []);

  const rate = useCallback(async (code: string, stars: number, comment: string) => {
    await feedbackService.rate(code, stars, comment);
    setTickets((prev) =>
      prev.map((t) => (t.code === code ? { ...t, rating: stars, ratingComment: comment.trim() || undefined } : t)),
    );
  }, []);

  const value = useMemo<FeedbackValue>(
    () => ({ tickets, loading, error, reload, byCode, create, rate }),
    [tickets, loading, error, reload, byCode, create, rate],
  );

  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback(): FeedbackValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback phải nằm trong FeedbackProvider");
  return ctx;
}
