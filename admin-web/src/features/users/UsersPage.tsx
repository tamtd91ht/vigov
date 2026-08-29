"use client";

/**
 * Phân hệ Người dùng Mini App & Bảo mật (WBS #11).
 *
 * Nguồn dữ liệu: /users/citizens, /users/sessions, /users/blacklist.
 * Số điện thoại công dân do backend che sẵn ("098•••321").
 *
 * LƯU Ý NGHIỆP VỤ (câu hỏi mở #15 — chờ khách hàng xác nhận):
 * - Quyền khoá / mở tài khoản công dân trực tiếp thuộc vai trò nào?
 * - Ai được xem tab Blacklist (hiện mở cho mọi người truy cập phân hệ)?
 */

import { useEffect, useState } from "react";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHead } from "@/components/ui/PageHead";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { formatNumber } from "@/lib/format";
import { useApiResource } from "@/hooks/useApiResource";
import { ApiError } from "@/services/api";
import {
  listCitizens,
  lockCitizen,
  unlockCitizen,
  type CitizenAccount,
} from "@/services/users.service";
import { CitizenTable } from "./CitizenTable";
import { SessionTables } from "./SessionTables";
import { BlacklistTable } from "./BlacklistTable";

const PAGE_SUB = "Tài khoản công dân trên Zalo Mini App, phiên đăng nhập và danh sách chặn";

const TAB_ITEMS = [
  { key: "citizens", label: "Công dân" },
  { key: "sessions", label: "Phiên đăng nhập" },
  { key: "blacklist", label: "Blacklist" },
];

/** Số công dân mỗi trang gửi lên tham số `limit` */
const CITIZEN_PAGE_SIZE = 20;
/** Độ trễ gõ phím trước khi gửi từ khoá lên máy chủ */
const SEARCH_DEBOUNCE_MS = 350;

export function UsersPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState(TAB_ITEMS[0].key);

  // Bộ lọc công dân — mọi giá trị đều đi thẳng vào tham số truy vấn
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [areaKey, setAreaKey] = useState("all");
  const [page, setPage] = useState(1);
  const [busyPhone, setBusyPhone] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const citizens = useApiResource(
    () =>
      listCitizens({
        q: debouncedSearch || undefined,
        area: areaKey === "all" ? undefined : areaKey,
        page,
        limit: CITIZEN_PAGE_SIZE,
      }),
    [debouncedSearch, areaKey, page],
  );

  /** Hai thẻ thống kê đầu trang lấy đúng tổng số máy chủ đếm được */
  const stats = useApiResource(async () => {
    const [all, locked] = await Promise.all([
      listCitizens({ page: 1, limit: 1 }),
      listCitizens({ page: 1, limit: 1, status: "locked" }),
    ]);
    return { total: all.total, locked: locked.total };
  }, []);

  const failed = (err: unknown, fallback: string) => showToast(err instanceof ApiError ? err.message : fallback);

  const refreshCitizens = () => {
    citizens.reload();
    stats.reload();
  };

  const handleLock = async (user: CitizenAccount, reason: string) => {
    setBusyPhone(user.phone);
    try {
      await lockCitizen(user.phone, reason);
      showToast(`Đã khoá tài khoản ${user.displayName} và đưa vào blacklist`);
      refreshCitizens();
    } catch (err) {
      failed(err, "Không khoá được tài khoản công dân");
    } finally {
      setBusyPhone(null);
    }
  };

  const handleUnlock = async (user: CitizenAccount) => {
    setBusyPhone(user.phone);
    try {
      await unlockCitizen(user.phone);
      showToast(`Đã mở khoá tài khoản ${user.displayName}`);
      refreshCitizens();
    } catch (err) {
      failed(err, "Không mở khoá được tài khoản công dân");
    } finally {
      setBusyPhone(null);
    }
  };

  const kpiValue = (value: number | undefined) =>
    stats.loading || value === undefined ? "…" : formatNumber(value);

  return (
    <div className="pg">
      <PageHead title="Người dùng Mini App & Bảo mật" sub={PAGE_SUB} />

      <div className="kpis" style={{ marginBottom: 22 }}>
        <KpiCard
          value={kpiValue(stats.data?.total)}
          label="Tổng công dân đã đăng ký"
          sub="Qua Zalo Mini App và app công dân"
          color="var(--blue)"
          tint="rgba(59,130,196,.07)"
          icon="users"
        />
        <KpiCard
          value="—"
          label="Hoạt động 30 ngày qua"
          sub="Cần API thống kê hoạt động của người dùng"
          color="var(--green)"
          tint="rgba(39,174,96,.07)"
          icon="ok"
        />
        <KpiCard
          value={kpiValue(stats.data?.locked)}
          label="Tài khoản bị khoá"
          sub="Do vi phạm quy định gửi phản ánh"
          color="var(--red)"
          tint="rgba(231,76,60,.07)"
          icon="lock"
        />
      </div>

      <Tabs items={TAB_ITEMS} active={tab} onChange={setTab} />

      {tab === "citizens" && (
        <CitizenTable
          citizens={citizens.data?.items ?? []}
          loading={citizens.loading}
          error={citizens.error}
          onRetry={citizens.reload}
          total={citizens.data?.total ?? 0}
          page={citizens.data?.page ?? page}
          limit={citizens.data?.limit ?? CITIZEN_PAGE_SIZE}
          onPageChange={setPage}
          search={search}
          onSearchChange={setSearch}
          areaKey={areaKey}
          onAreaChange={(key) => {
            setAreaKey(key);
            setPage(1);
          }}
          busyPhone={busyPhone}
          onLock={handleLock}
          onUnlock={handleUnlock}
        />
      )}
      {tab === "sessions" && <SessionTables />}
      {tab === "blacklist" && <BlacklistTable />}
    </div>
  );
}
