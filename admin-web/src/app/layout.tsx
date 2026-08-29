import type { Metadata } from "next";
import { appConfig } from "@/config/app.config";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: `${appConfig.appName} — Nền tảng Điều hành số cấp Xã/Phường`,
  description: `${appConfig.appName} · ${appConfig.appTagline} · ${appConfig.org.name}`,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
