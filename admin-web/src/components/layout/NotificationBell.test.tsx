import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { ApiResource } from "@/hooks/useApiResource";
import type { InboxNotification, InboxPage } from "@/services/notifications.service";
import { NotificationBell } from "./NotificationBell";

/**
 * VÌ SAO TEST: trước bản này `markNotificationRead` được export nhưng không nơi
 * nào gọi, nên con số đỏ trên chuông không bao giờ tắt. Hai điều phải giữ đúng:
 * bấm một thông báo thì badge giảm NGAY (không chờ vòng gọi API thứ hai), và
 * "đánh dấu tất cả" chỉ gửi những mã CHƯA đọc chứ không gửi lại cả danh sách.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const markNotificationRead = vi.fn();
const markNotificationsRead = vi.fn();
vi.mock("@/services/notifications.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/notifications.service")>();
  return {
    ...actual,
    markNotificationRead: (...args: unknown[]) => markNotificationRead(...args),
    markNotificationsRead: (...args: unknown[]) => markNotificationsRead(...args),
  };
});

function makeItem(overrides: Partial<InboxNotification> = {}): InboxNotification {
  return {
    id: "n1",
    title: "Bạn được phân công xử lý phản ánh PA-2608",
    body: "Rác thải tồn đọng tại thôn Đông",
    read: false,
    createdAt: "2026-09-06T03:06:00.000Z",
    data: { feedbackCode: "PA-2608" },
    ...overrides,
  };
}

/**
 * Dựng một `ApiResource` giả có state thật: `setData` phải thay đổi dữ liệu
 * hiển thị, vì chính đường đi đó mới làm badge giảm.
 */
function renderBell(items: InboxNotification[]) {
  const reload = vi.fn();
  let current: InboxPage = {
    items,
    total: items.length,
    unread: items.filter((n) => !n.read).length,
    page: 1,
    limit: 10,
  };

  function Harness() {
    const [data, setDataState] = React.useState<InboxPage>(current);
    const resource: ApiResource<InboxPage> = {
      data,
      loading: false,
      error: null,
      reload,
      setData: (updater) => {
        setDataState((prev) => {
          const next = (typeof updater === "function"
            ? (updater as (p: InboxPage | null) => InboxPage | null)(prev)
            : updater) as InboxPage;
          current = next;
          return next;
        });
      },
    };
    return <NotificationBell inbox={resource} />;
  }

  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );

  return { reload, page: () => current };
}

describe("NotificationBell", () => {
  beforeEach(() => {
    push.mockReset();
    markNotificationRead.mockReset().mockResolvedValue(undefined);
    markNotificationsRead.mockReset();
  });

  it("badge hiện đúng số chưa đọc", () => {
    renderBell([makeItem(), makeItem({ id: "n2", read: true })]);

    expect(screen.getByRole("button", { name: "Thông báo (1 chưa đọc)" })).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("không còn thông báo chưa đọc thì không hiện badge", () => {
    renderBell([makeItem({ read: true })]);

    expect(screen.getByRole("button", { name: "Thông báo" })).toBeInTheDocument();
  });

  it("bấm một thông báo: gọi API đánh dấu đã đọc, badge giảm và mở bản ghi liên quan", async () => {
    const user = userEvent.setup();
    renderBell([makeItem(), makeItem({ id: "n2", title: "Nhiệm vụ NV-2601 sắp đến hạn" })]);

    await user.click(screen.getByRole("button", { name: /Thông báo/ }));
    await user.click(screen.getByText("Bạn được phân công xử lý phản ánh PA-2608"));

    expect(markNotificationRead).toHaveBeenCalledWith("n1");
    expect(push).toHaveBeenCalledWith("/feedback?code=PA-2608");
    // Còn lại đúng một thông báo chưa đọc
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Thông báo (1 chưa đọc)" })).toBeInTheDocument(),
    );
  });

  it("thông báo đã đọc thì chỉ điều hướng, không gọi lại API", async () => {
    const user = userEvent.setup();
    renderBell([makeItem({ read: true })]);

    await user.click(screen.getByRole("button", { name: "Thông báo" }));
    await user.click(screen.getByText("Bạn được phân công xử lý phản ánh PA-2608"));

    expect(push).toHaveBeenCalledWith("/feedback?code=PA-2608");
    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it("thông báo không suy được bản ghi liên quan thì không điều hướng đi đâu", async () => {
    const user = userEvent.setup();
    renderBell([makeItem({ data: { templateKey: "he-thong" } })]);

    await user.click(screen.getByRole("button", { name: /Thông báo/ }));
    await user.click(screen.getByText("Bạn được phân công xử lý phản ánh PA-2608"));

    expect(markNotificationRead).toHaveBeenCalledWith("n1");
    expect(push).not.toHaveBeenCalled();
  });

  it("đánh dấu tất cả chỉ gửi mã CHƯA đọc và làm tắt badge", async () => {
    markNotificationsRead.mockResolvedValue(2);
    const user = userEvent.setup();
    renderBell([
      makeItem(),
      makeItem({ id: "n2", read: true, title: "Đã đọc trước đó" }),
      makeItem({ id: "n3", title: "Nhiệm vụ NV-2601 sắp đến hạn" }),
    ]);

    await user.click(screen.getByRole("button", { name: /Thông báo/ }));
    await user.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));

    expect(markNotificationsRead).toHaveBeenCalledWith(["n1", "n3"]);
    await waitFor(() => expect(screen.getByRole("button", { name: "Thông báo" })).toBeInTheDocument());
  });

  it("đã đọc hết thì nút đánh dấu bị khoá", async () => {
    const user = userEvent.setup();
    renderBell([makeItem({ read: true })]);

    await user.click(screen.getByRole("button", { name: "Thông báo" }));

    expect(screen.getByRole("button", { name: "Đánh dấu đã đọc" })).toBeDisabled();
    expect(screen.getByText("Đã đọc hết")).toBeInTheDocument();
  });

  it("hộp thư rỗng thì nói rõ, không để khay trống", async () => {
    const user = userEvent.setup();
    renderBell([]);

    await user.click(screen.getByRole("button", { name: "Thông báo" }));

    expect(screen.getByText("Chưa có thông báo nào")).toBeInTheDocument();
  });

  it("một phần thất bại thì chỉ trừ số đã thành công và tải lại hộp thư", async () => {
    markNotificationsRead.mockResolvedValue(1);
    const user = userEvent.setup();
    const { reload } = renderBell([makeItem(), makeItem({ id: "n2", title: "Nhiệm vụ NV-2601 sắp đến hạn" })]);

    await user.click(screen.getByRole("button", { name: /Thông báo/ }));
    await user.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Thông báo (1 chưa đọc)" })).toBeInTheDocument(),
    );
    expect(reload).toHaveBeenCalled();
  });
});
