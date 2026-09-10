"""PreToolUse hook — CHẶN ghi log dữ liệu cá nhân của công dân.

Phạm vi: Edit | Write | MultiEdit

VÌ SAO CHẶN CHỨ KHÔNG CẢNH BÁO: log của tiến trình đi vào docker logs, đi vào hệ thống
log tập trung, đi vào bản sao lưu. Một dòng `console.log(citizenPhone)` viết lúc gỡ lỗi
sẽ nằm lại và đẩy số điện thoại của cả một xã ra nơi không ai kiểm soát. Nghị định
13/2023/NĐ-CP coi đó là hành vi xử lý dữ liệu cá nhân không có cơ sở.

Cũng chặn: dữ liệu cá nhân thật (số điện thoại Việt Nam 10 số, số CCCD 12 số) viết cứng
trong mã nguồn.
"""

from __future__ import annotations

import json
import os
import re
import sys

# Hàm ghi log của ba module: TypeScript/JS (console, Nest Logger).
LOG_CALL = r"""(?:console\.(?:log|info|warn|error|debug|trace)|logger\.(?:log|info|warn|error|debug|verbose)|Logger\.(?:log|error|warn|debug|verbose)|print|debugPrint|stderr\.write|stdout\.write)"""

# Tên biến/trường mang dữ liệu cá nhân hoặc bí mật xác thực.
PII_TOKEN = r"""(?:citizenPhone|applicantPhone|citizenName|applicantName|phoneNumber|phone|soDienThoai|cccd|cmnd|canCuoc|identityNumber|idNumber|otp|otpCode|maXacThuc|password|passwordHash|matKhau|accessToken|refreshToken|bearer|jwt|sessionId|\bsid\b)"""

PATTERNS: list[tuple[str, str]] = [
    (
        rf"""{LOG_CALL}\s*\([^)\n]{{0,200}}{PII_TOKEN}""",
        "ghi log dữ liệu cá nhân / bí mật xác thực",
    ),
    (
        # Template string trong log: `... ${phone} ...`
        rf"""{LOG_CALL}\s*\(\s*[`'"][^`'"\n]{{0,200}}\$\{{[^}}\n]{{0,80}}{PII_TOKEN}""",
        "ghi log dữ liệu cá nhân qua chuỗi ghép",
    ),
    (
        # Log cả object request/user — kéo theo mọi trường bên trong
        rf"""{LOG_CALL}\s*\(\s*(?:req\.body|req\.user|request\.body|dto|payload|body)\s*[,)]""",
        "ghi log nguyên cả body / user — kéo theo mọi trường bên trong",
    ),
    (
        # Số điện thoại Việt Nam thật viết cứng
        r"""["'`]0(?:3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])\d{7}["'`]""",
        "số điện thoại thật viết cứng trong mã",
    ),
    (
        # Số CCCD 12 chữ số viết cứng
        r"""["'`]0\d{11}["'`]""",
        "số căn cước 12 chữ số viết cứng trong mã",
    ),
]

# Vùng cho phép: test, mock, seed — nhưng CHỈ với số giả (xem SAFE_FAKE).
SKIP_FRAGMENTS = (
    "/test/", "/tests/", "/__tests__/", "/fixtures/", "/mocks/", "/__mocks__/",
    "/.claude/", "/node_modules/", "/dist/", ".spec.", ".test.",
)
SKIP_EXTENSIONS = (".md", ".txt", ".csv", ".lock", ".log", ".snap", ".json")

# Số giả quy ước dùng trong test — không phải dữ liệu cá nhân thật.
SAFE_FAKE = re.compile(r"^0(?:9|3|7|8|5)0{6,9}\d?$")


def read_input() -> dict:
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


def should_skip(path: str) -> bool:
    norm = path.replace("\\", "/").lower()
    return any(f in norm for f in SKIP_FRAGMENTS) or norm.endswith(SKIP_EXTENSIONS)


def new_content(tool_input: dict) -> str:
    if "content" in tool_input:
        return tool_input.get("content") or ""
    parts: list[str] = []
    if tool_input.get("new_string") is not None:
        parts.append(tool_input.get("new_string") or "")
    for edit in tool_input.get("edits") or []:
        parts.append(edit.get("new_string") or "")
    return "\n".join(parts)


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
    if not path or should_skip(path):
        sys.exit(0)

    content = new_content(tool_input)
    if not content:
        sys.exit(0)

    hits: list[str] = []
    for pattern, label in PATTERNS:
        for m in re.finditer(pattern, content, re.IGNORECASE):
            snippet = m.group(0).replace("\n", " ").strip()
            # Bỏ qua số giả quy ước (0900000000) dùng trong ví dụ
            digits = re.sub(r"\D", "", snippet)
            if digits and SAFE_FAKE.match(digits):
                continue
            if len(snippet) > 90:
                snippet = snippet[:87] + "…"
            hits.append(f"{label}: {snippet}")

    if hits:
        msg = ["", f"[ViGov · CHẶN] dữ liệu cá nhân trong {os.path.basename(path)}"]
        msg.extend(f"  - {h}" for h in hits[:6])
        if len(hits) > 6:
            msg.append(f"  ... và {len(hits) - 6} chỗ nữa")
        msg += [
            "",
            "  Log của tiến trình đi vào docker logs, log tập trung, và bản sao lưu.",
            "  Cách làm đúng:",
            "    - Cần theo dõi thì log MÃ NGHIỆP VỤ (code, arrivalNo) hoặc số ĐÃ CHE",
            "    - Số điện thoại / CCCD ra ngoài luôn qua hàm che (maskPhone / maskCccd)",
            "    - Ví dụ trong mã dùng số giả: 0900000000",
            "  → Luật: .claude/rules/critical/du-lieu-ca-nhan.md",
            "  → Kỹ năng: .claude/skills/che-du-lieu-ca-nhan/SKILL.md",
        ]
        print("\n".join(msg), file=sys.stderr)
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
