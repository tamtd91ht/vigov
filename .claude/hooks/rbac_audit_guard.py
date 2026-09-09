"""PostToolUse hook — nhắc khi endpoint mới thiếu khai báo quyền.

Phạm vi: Edit | Write | MultiEdit trên *.controller.ts của backend

VÌ SAO LÀ POST CHỨ KHÔNG PHẢI PRE: một lần Edit có thể mới viết được nửa route, chặn ở
Pre sẽ chặn công việc đang làm dở. Ở Post, thông báo đi vào ngữ cảnh của Claude như một
việc phải sửa nốt trước khi kết thúc.

Luật gốc: mọi endpoint khai báo TƯỜNG MINH `@RequirePermission(...)`, `@Public()`
hoặc `@AnyAuthenticated('<lý do>')` (mở cho mọi tài khoản đã đăng nhập, kể cả công dân —
bảng RBAC không có vai trò công dân nên @RequirePermission sẽ chặn đúng người cần dùng).
Không có mặc định ngầm. Guard toàn cục sẽ chặn nếu thiếu token, nhưng KHÔNG kiểm quyền
nếu không có decorator — nghĩa là mọi cán bộ, mọi vai trò đều gọi được.
"""

from __future__ import annotations

import io
import os
import json
import re
import sys

ROUTE_DECORATOR = re.compile(
    r"""^\s*@(Get|Post|Patch|Put|Delete|All)\s*\(""", re.MULTILINE
)
AUTH_DECORATOR = re.compile(
    r"""@(RequirePermission|Public|AllowPendingPassword|AnyAuthenticated)\s*\("""
)
# Cửa sổ dòng phía trên/dưới decorator route để tìm khai báo quyền
WINDOW = 6

# Đường của CÔNG DÂN không dùng RBAC — công dân không có vai trò. Chúng cách ly bằng
# citizenPhone lấy từ phiên (rules/critical/cach-ly-du-lieu-cong-dan.md). Bỏ qua ở đây
# để hook không báo động sai; việc kiểm cách ly là của agents/ra-soat-bao-mat.
CITIZEN_ROUTE = re.compile(r"""@\w+\s*\(\s*["'`](?:/)?citizen""")


def read_input() -> dict:
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


def unguarded_routes(path: str) -> list[str]:
    """Trả về danh sách route thiếu khai báo quyền, dạng '@Get(...) dòng N'."""
    try:
        with io.open(path, encoding="utf-8", errors="ignore") as f:
            lines = f.read().splitlines()
    except Exception:
        return []

    findings: list[str] = []
    for i, line in enumerate(lines):
        if not ROUTE_DECORATOR.match(line + "\n"):
            continue
        lo = max(0, i - WINDOW)
        hi = min(len(lines), i + WINDOW + 1)
        window = "\n".join(lines[lo:hi])
        if CITIZEN_ROUTE.search(line):
            continue
        if not AUTH_DECORATOR.search(window):
            findings.append(f"dòng {i + 1}: {line.strip()[:60]}")
    return findings


def _utf8_streams() -> None:
    """Terminal Windows mac dinh cp1252 — khong in duoc tieng Viet. Doi sang UTF-8."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def main() -> None:
    _utf8_streams()
    data = read_input()
    tool = data.get("tool_name") or data.get("tool") or ""
    if tool not in ("Edit", "Write", "MultiEdit"):
        sys.exit(0)

    tool_input = data.get("tool_input") or data.get("input") or {}
    path = tool_input.get("file_path") or ""
    norm = path.replace("\\", "/")
    if not norm.endswith(".controller.ts") or "/backend/" not in norm:
        sys.exit(0)
    if ".spec." in norm or "/test/" in norm:
        sys.exit(0)

    findings = unguarded_routes(path)
    if not findings:
        sys.exit(0)

    msg = [
        "",
        f"[ViGov] {os.path.basename(path)} — {len(findings)} route CHƯA khai báo quyền:",
        *[f"  - {f}" for f in findings[:8]],
    ]
    if len(findings) > 8:
        msg.append(f"  ... và {len(findings) - 8} route nữa")
    msg += [
        "",
        "  Mọi endpoint phải khai TƯỜNG MINH một trong hai:",
        "    @RequirePermission('<phân-hệ>', 'view'|'edit'|'approve'|'admin')",
        "    @Public()   // CÔNG KHAI — <lý do cụ thể>",
        "    @AnyAuthenticated('<vì sao công dân cũng phải gọi được>')",
        "",
        "  Thiếu decorator: guard vẫn chặn người chưa đăng nhập, nhưng MỌI vai trò cán bộ",
        "  đều gọi được — kể cả vai trò không liên quan tới phân hệ đó.",
        "  Đường của công dân thì cách ly theo citizenPhone lấy từ phiên, không dùng RBAC.",
        "",
        "  Nhớ thêm test: 401 không token · 403 sai quyền · 200 đúng quyền.",
        "  → Luật: .claude/rules/critical/phan-quyen-rbac.md",
    ]
    print("\n".join(msg), file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
