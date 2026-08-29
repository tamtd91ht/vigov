"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appConfig } from "@/config/app.config";
import { navSections } from "@/config/nav.config";
import { Icon } from "@/lib/icons";
import { useApiResource } from "@/hooks/useApiResource";
import { fetchDashboard } from "@/services/dashboard.service";

/** Năm lấy số liệu badge — dùng năm hiện hành như trang Tổng quan */
const BADGE_YEAR = new Date().getFullYear();

export function Sidebar() {
  const pathname = usePathname();

  // Số đếm badge lấy từ cùng nguồn với trang Tổng quan; chưa tải xong hoặc lỗi thì không hiện số
  const { data } = useApiResource(() => fetchDashboard(BADGE_YEAR), []);
  const badges: Record<string, number> | null = data
    ? {
        tasks: data.kpis.activeTasks,
        documents: data.kpis.pendingDocuments,
        feedback: Math.max(0, data.kpis.feedbackTotal - data.kpis.feedbackResolved),
      }
    : null;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="sb">
      <div className="sb-logo">
        <div className="mark">{appConfig.org.short}</div>
        <div>
          <b>{appConfig.appName}</b>
          <span>{appConfig.appTagline}</span>
        </div>
      </div>
      <nav className="sb-menu">
        {navSections.map((section, si) => (
          <div key={si} style={{ display: "contents" }}>
            {section.caption && <div className="sb-cap">{section.caption}</div>}
            {section.items.map((item) => (
              <Link key={item.id} href={item.href} className={`sb-item ${isActive(item.href) ? "on" : ""}`}>
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                {item.badgeKey && badges && badges[item.badgeKey] > 0 && (
                  <span className="cnt">{badges[item.badgeKey]}</span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="sb-foot">
        Phiên bản {appConfig.version}
        {appConfig.api.useMocks && (
          <>
            <br />
            Dữ liệu mô phỏng phục vụ trình diễn
          </>
        )}
      </div>
    </aside>
  );
}
