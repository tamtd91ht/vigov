"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from "@/config/app.config";
import { authService } from "@/services/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Vui lòng nhập đầy đủ tài khoản và mật khẩu");
      return;
    }
    setLoading(true);
    const result = await authService.login(username.trim(), password);
    if (result.ok) {
      router.replace(appConfig.auth.afterLoginPath);
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <div className="mark">{appConfig.org.short}</div>
          <div>
            <b>{appConfig.appName}</b>
            <span>{appConfig.appTagline}</span>
          </div>
        </div>
        <p className="sm muted" style={{ marginBottom: 18 }}>
          Đăng nhập dành cho cán bộ, công chức {appConfig.org.name}
        </p>
        <div className="fgroup">
          <label>
            Tài khoản <span className="req">*</span>
          </label>
          <input
            className="finp"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="vd: binh.nv"
            autoComplete="username"
          />
        </div>
        <div className="fgroup">
          <label>
            Mật khẩu <span className="req">*</span>
          </label>
          <input
            className="finp"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          {error && <div className="ferr">{error}</div>}
        </div>
        <button className="btn pri" style={{ width: "100%", justifyContent: "center", padding: "11px" }} disabled={loading}>
          {loading ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
        {/* Chế độ demo: hiện sẵn tài khoản dùng thử để khỏi phải mò. Không hiện khi nối backend thật. */}
        {appConfig.api.useMocks && appConfig.auth.demoUsername && (
          <div
            className="note"
            style={{ marginTop: 16, background: "rgba(59,130,196,.07)", border: "1px solid rgba(59,130,196,.22)", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "var(--navy)" }}
          >
            <b>Chế độ dùng thử</b> — đăng nhập bằng{" "}
            <code style={{ fontWeight: 700 }}>{appConfig.auth.demoUsername}</code> /{" "}
            <code style={{ fontWeight: 700 }}>{appConfig.auth.demoPassword}</code>
          </div>
        )}
        <div className="login-foot">
          {appConfig.org.name} · {appConfig.org.parent}
        </div>
      </form>
    </div>
  );
}
