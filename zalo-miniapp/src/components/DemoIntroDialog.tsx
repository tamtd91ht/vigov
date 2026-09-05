import { useState } from "react";
import { appConfig } from "@/config/app.config";
import { demoConfig } from "@/config/demo.config";
import { Icon } from "./Icon";

/**
 * Pop-up bắt buộc của bản demo — Zalo yêu cầu "hiển thị pop-up khi người dùng
 * truy cập vào app, thể hiện rõ đây là ứng dụng demo".
 *
 * Hiện lại mỗi lần mở app, cố ý không nhớ trạng thái đã đóng: người xét duyệt
 * mở app nhiều lần và lần nào cũng phải thấy. Đây không phải thứ gây phiền hằng
 * ngày vì bản chính thức sẽ tắt hẳn qua VITE_DEMO_MODE.
 *
 * Đặt ngoài RouterProvider (main.tsx) để phủ lên mọi màn, kể cả onboarding.
 */
export function DemoIntroDialog() {
  const [open, setOpen] = useState(appConfig.demoMode);
  if (!open) return null;

  return (
    <div className="demo-ov" role="dialog" aria-modal="true" aria-labelledby="demo-intro-title">
      <div className="demo-dlg">
        <span className="demo-dlg-ic">
          <Icon name="alert" size={26} color="var(--orange)" />
        </span>
        <h2 id="demo-intro-title">{demoConfig.intro.title}</h2>
        {demoConfig.intro.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <button className="btn pri" onClick={() => setOpen(false)}>
          {demoConfig.intro.confirm}
        </button>
      </div>
    </div>
  );
}
