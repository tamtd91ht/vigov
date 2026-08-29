import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { appConfig } from "@/config/app.config";

/** Mức cỡ chữ toàn app (WBS #20) */
export interface FontScaleOption {
  key: string;
  label: string;
  scale: number;
}

export const fontScaleOptions: FontScaleOption[] = [
  { key: "normal", label: "Chuẩn", scale: 1 },
  { key: "large", label: "Lớn", scale: 1.15 },
  { key: "xlarge", label: "Rất lớn", scale: 1.3 },
];

interface SettingsValue {
  font: FontScaleOption;
  setFont: (o: FontScaleOption) => void;
  notificationsEnabled: boolean;
  setNotifications: (v: boolean) => void;
}

const SettingsContext = createContext<SettingsValue>({
  font: fontScaleOptions[0],
  setFont: () => {},
  notificationsEnabled: true,
  setNotifications: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [font, setFontState] = useState<FontScaleOption>(() => {
    const key = localStorage.getItem(appConfig.storageKeys.fontScale);
    return fontScaleOptions.find((o) => o.key === key) ?? fontScaleOptions[0];
  });
  const [notificationsEnabled, setNotificationsState] = useState<boolean>(
    () => localStorage.getItem(appConfig.storageKeys.notifications) !== "false",
  );

  // Cỡ chữ áp dụng toàn app qua CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", String(font.scale));
  }, [font]);

  const setFont = useCallback((o: FontScaleOption) => {
    setFontState(o);
    localStorage.setItem(appConfig.storageKeys.fontScale, o.key);
  }, []);

  const setNotifications = useCallback((v: boolean) => {
    // Đăng ký/huỷ nhận thông báo Zalo thật thực hiện ở Notification service P3 (#23)
    setNotificationsState(v);
    localStorage.setItem(appConfig.storageKeys.notifications, String(v));
  }, []);

  const value = useMemo<SettingsValue>(
    () => ({ font, setFont, notificationsEnabled, setNotifications }),
    [font, setFont, notificationsEnabled, setNotifications],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
