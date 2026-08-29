"use client";

import { useState } from "react";
import type { SlaRule } from "@/config/sla.config";
import { PageHead } from "@/components/ui/PageHead";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { DataState } from "@/components/ui/DataState";
import { useApiResource } from "@/hooks/useApiResource";
import { fetchSlaSettings } from "@/services/settings.service";
import { SlaConfigTable } from "./SlaConfigTable";
import { OrgTree } from "./OrgTree";
import { UserTable } from "./UserTable";
import { CategoryManager } from "./CategoryManager";

/** Phân hệ Cấu hình (WBS #9) — 4 tab: SLA, sơ đồ tổ chức, tài khoản, danh mục */

const TAB_ITEMS: TabItem[] = [
  { key: "sla", label: "SLA phản ánh" },
  { key: "org", label: "Sơ đồ tổ chức" },
  { key: "usr", label: "Tài khoản & phân quyền" },
  { key: "cat", label: "Danh mục phản ánh" },
];

export function SettingsPage() {
  const [tab, setTab] = useState("sla");
  // Bảng SLA tải một lần cho cả tab SLA và tab Danh mục (GET /settings/sla)
  const sla = useApiResource(() => fetchSlaSettings(), []);
  const rules = sla.data?.rules ?? [];

  const applyRules = (next: SlaRule[]) =>
    sla.setData((prev) => (prev ? { ...prev, rules: next } : { rules: next, isDefault: false }));

  return (
    <div className="pg">
      <PageHead
        title="Cấu hình hệ thống"
        sub="Thiết lập thời hạn xử lý, sơ đồ tổ chức, tài khoản người dùng và danh mục phản ánh của UBND xã"
      />
      <Tabs items={TAB_ITEMS} active={tab} onChange={setTab} />
      {tab === "sla" && (
        <DataState
          loading={sla.loading}
          error={sla.error}
          onRetry={sla.reload}
          empty={rules.length === 0}
          emptyMessage="Chưa có cấu hình SLA nào"
        >
          <SlaConfigTable rules={rules} onRulesChange={applyRules} />
        </DataState>
      )}
      {tab === "org" && <OrgTree />}
      {tab === "usr" && <UserTable />}
      {tab === "cat" && (
        <DataState loading={sla.loading} error={sla.error} onRetry={sla.reload}>
          <CategoryManager rules={rules} />
        </DataState>
      )}
    </div>
  );
}
