"""PreToolUse hook — CHẶN secret viết cứng trong mã, và giá trị thật lọt vào .env.example.

Phạm vi: Edit | Write | MultiEdit | NotebookEdit

Hai việc:
  1. Chặn credential viết cứng trong mã nguồn (mật khẩu, khoá API, PEM, JWT, chuỗi
     kết nối có credential).
  2. Chặn ghi giá trị thật vào `.env.example` — tệp này là MẪU, chỉ được chứa giá trị
     giữ chỗ. Đây là luật riêng của ViGov (rules/critical/bi-mat-cau-hinh.md).

Nguyên tắc: mẫu regex phải ĐỘ CHÍNH XÁC CAO. Báo động sai làm người dùng tắt hook,
và khi đó ta mất cả lớp bảo vệ. Chỉ khớp khi giá trị thật nằm ngay trong mã — cách
gián tiếp qua biến môi trường (${X}, process.env.X, ConfigService.get) KHÔNG bị chặn.
"""

from __future__ import annotations

import json
import os
import re
import sys

# Mỗi mẫu là một dấu hiệu độ chính xác cao: giá trị thật có mặt ngay trong mã.
SECRET_PATTERNS: list[tuple[str, str]] = [
    (
        r"""(?i)\b(password|passwd|pwd|mat_khau)\s*[:=]\s*["'`][^"'`$\{][^"'`]{3,}["'`]""",
        "mật khẩu viết cứng",
    ),
    (
        r"""(?i)\b(api[_\-]?key|access[_\-]?key|secret[_\-]?key|client[_\-]?secret|app[_\-]?secret|jwt[_\-]?secret|server[_\-]?key)\s*[:=]\s*["'`][^"'`$\{][^"'`]{7,}["'`]""",
        "khoá API / secret viết cứng",
    ),
    (
        r"""-----BEGIN\s+(RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----""",
        "khối khoá riêng nhúng trong mã",
    ),
    (
        r"""\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b""",
        "token JWT nhúng trong mã",
    ),
    (
        r"""(?i)(mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqps?):\/\/[^\s:@\/"']+:[^\s@\/"']{3,}@""",
        "chuỗi kết nối có credential",
    ),
    (
        r"""\b(AKIA|ASIA)[0-9A-Z]{16}\b""",
        "khoá truy cập AWS",
    ),
]

# Bỏ qua: test, fixture, mock, tài liệu — vùng dễ báo động sai.
SKIP_FRAGMENTS = (
    "/test/", "/tests/", "/__tests__/", "/fixtures/", "/mocks/", "/__mocks__/",
    "/seed-data/", "/.claude/", "/node_modules/", "/docs/", "/plans/", "/dist/",
    ".spec.", ".test.", ".sample",
)
SKIP_EXTENSIONS = (".md", ".txt", ".csv", ".lock", ".log", ".snap")

# Quét .env.example theo TÊN BIẾN, không theo độ dài giá trị.
#
# VÌ SAO: `.env.example` có rất nhiều giá trị mẫu dài mà hoàn toàn hợp lệ —
# `TZ=Asia/Ho_Chi_Minh`, `API_PROXY_TARGET=http://backend:3001`, giờ làm việc bằng
# tiếng Việt. Chặn theo độ dài sẽ báo động sai liên tục, và hook bị tắt là mất cả lớp
# bảo vệ. Chỉ những biến MANG BÍ MẬT mới bị soi, và chỉ khi giá trị không phải giữ chỗ.
ENV_KEY_SECRETISH = re.compile(
    r"(SECRET|PASSWORD|PASSWD|_PASS$|TOKEN|CREDENTIAL|PRIVATE_KEY|APIKEY|API_KEY|"
    r"ACCESS_KEY|SERVER_KEY|_KEY$|SALT|SIGNATURE|BYPASS_CODE|_DSN$|_URI$|_URL$)",
    re.IGNORECASE,
)

# Dấu hiệu giá trị là GIỮ CHỖ, không phải giá trị thật.
PLACEHOLDER_MARK = re.compile(
    r"(change[-_]?me|changeme|todo|xxx+|your[-_]|<[^>]*>|\.\.\.|example\.com|"
    r"guest:guest|mock|dummy|placeholder|thay[-_]?the|dien[-_]?vao)",
    re.IGNORECASE,
)

# Host vô hại: máy cục bộ, tên service trong Docker Compose, cổng thuần.
HARMLESS_HOST = re.compile(
    r"^(https?|amqps?|mongodb(\+srv)?|redis|postgres(ql)?)?:?/?/?"
    r"(localhost|127\.0\.0\.1|0\.0\.0\.0|backend|mongo|mongodb|rabbitmq|redis|minio|"
    r"api|web|nginx)([:/]|$)",
    re.IGNORECASE,
)

# Biến CÔNG KHAI: giá trị nằm trong bundle gửi trình duyệt, nên tự nó không thể là bí
# mật. Việc đặt tên bí mật sau tiền tố công khai do env_sync_guard.py nhắc.
PUBLIC_PREFIX = re.compile(r"^(NEXT_PUBLIC_|VITE_)", re.IGNORECASE)


def read_input() -> dict:
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


def should_skip(path: str) -> bool:
    norm = path.replace("\\", "/").lower()
    return any(f in norm for f in SKIP_FRAGMENTS) or norm.endswith(SKIP_EXTENSIONS)


def new_content(tool_input: dict) -> str:
    """Chỉ lấy phần nội dung SẼ được ghi — không quét phần bị thay thế."""
    if "content" in tool_input:
        return tool_input.get("content") or ""
    parts: list[str] = []
    if tool_input.get("new_string") is not None:
        parts.append(tool_input.get("new_string") or "")
    for edit in tool_input.get("edits") or []:
        parts.append(edit.get("new_string") or "")
    return "\n".join(parts)


def block(title: str, details: list[str], hint: str) -> None:
    msg = ["", f"[ViGov · CHẶN] {title}"]
    msg.extend(f"  - {d}" for d in details[:6])
    if len(details) > 6:
        msg.append(f"  ... và {len(details) - 6} chỗ nữa")
    msg.append(f"  → {hint}")
    msg.append("  → Luật: .claude/rules/critical/bi-mat-cau-hinh.md")
    print("\n".join(msg), file=sys.stderr)
    sys.exit(2)


def scan_env_example(content: str, path: str) -> None:
    """`.env.example` là MẪU — giá trị thật ở đây sẽ bị commit lên git.

    Chỉ soi biến mang bí mật (theo TÊN), và chỉ báo khi giá trị không có dấu hiệu
    giữ chỗ. Xem ghi chú ở ENV_KEY_SECRETISH về lý do không chặn theo độ dài.
    """
    bad: list[str] = []
    for lineno, line in enumerate(content.splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if not value:
            continue
        if PUBLIC_PREFIX.match(key):
            continue
        if not ENV_KEY_SECRETISH.search(key):
            continue
        if PLACEHOLDER_MARK.search(value):
            continue
        if HARMLESS_HOST.match(value):
            continue
        # Chuỗi có khoảng trắng là văn bản hiển thị, không phải bí mật
        if " " in value:
            continue

        bad.append(
            f"dòng {lineno}: {key}=<giá trị {len(value)} ký tự, không có dấu hiệu "
            f"giữ chỗ — đã ẩn>"
        )

    if bad:
        block(
            f"nghi vấn giá trị thật trong tệp MẪU {os.path.basename(path)}",
            bad,
            "Giá trị thật vào .env.local; .env.example chỉ để tên biến + giữ chỗ "
            "(rỗng hoặc change-me-...) + một dòng chú thích.",
        )


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
    if tool not in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
        sys.exit(0)

    tool_input = data.get("tool_input") or data.get("input") or {}
    path = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
    if not path:
        sys.exit(0)

    content = new_content(tool_input)
    if not content:
        sys.exit(0)

    norm = path.replace("\\", "/")

    # .env.example: luật riêng, kiểm trước và KHÔNG bỏ qua theo phần mở rộng
    if norm.endswith(".env.example"):
        scan_env_example(content, path)
        sys.exit(0)

    if should_skip(path):
        sys.exit(0)

    hits: list[str] = []
    for pattern, label in SECRET_PATTERNS:
        for m in re.finditer(pattern, content):
            snippet = m.group(0)
            # Chỉ hiện 24 ký tự đầu — không in nguyên giá trị bí mật ra terminal
            head = snippet[:24].replace("\n", " ")
            hits.append(f"{label}: {head}…")

    if hits:
        block(
            f"phát hiện bí mật viết cứng trong {os.path.basename(path)}",
            hits,
            "Dùng biến môi trường: ConfigService.get('...') ở backend, "
            "app.config.ts ở client. Khai biến trong CẢ .env.local và .env.example.",
        )

    sys.exit(0)


if __name__ == "__main__":
    main()
