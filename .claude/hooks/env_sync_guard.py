"""PostToolUse hook — nhắc khi cặp .env.local / .env.example lệch nhau.

Phạm vi: Edit | Write trên tệp .env*

VÌ SAO: `.env.local` giữ giá trị thật (không commit), `.env.example` là mẫu (commit).
Thêm biến vào một bên mà quên bên kia thì người tiếp theo clone repo về sẽ THIẾU biến
mà không có cách nào biết — ứng dụng chạy với chuỗi rỗng và không báo lỗi.

Với `admin-web` và `zalo-miniapp` còn nguy hơn: biến `NEXT_PUBLIC_*` / `VITE_*` được
nhúng thẳng vào bundle gửi trình duyệt, nên hook cũng nhắc nếu tên biến nghe như bí mật.

Chỉ SO SÁNH TÊN BIẾN. Không đọc, không in, không so sánh giá trị.
"""

from __future__ import annotations

import io
import json
import os
import re
import sys

KEY_LINE = re.compile(r"""^\s*([A-Z][A-Z0-9_]*)\s*=""")

# Tên biến nghe như bí mật — không được đặt sau tiền tố công khai.
SECRETISH = re.compile(
    r"(SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE|CREDENTIAL|_KEY$|APIKEY|API_KEY|"
    r"ACCESS_KEY|BYPASS|SIGNATURE|SALT|SESSION_SECRET)",
    re.IGNORECASE,
)
PUBLIC_PREFIX = re.compile(r"^(NEXT_PUBLIC_|VITE_)")


def read_input() -> dict:
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


def keys_of(path: str) -> set[str]:
    if not os.path.exists(path):
        return set()
    out: set[str] = set()
    try:
        with io.open(path, encoding="utf-8", errors="ignore") as f:
            for line in f:
                if line.lstrip().startswith("#"):
                    continue
                m = KEY_LINE.match(line)
                if m:
                    out.add(m.group(1))
    except Exception:
        return set()
    return out


def pair_for(path: str) -> tuple[str, str] | None:
    """Trả về (đường dẫn tệp giá trị thật, đường dẫn tệp mẫu) cho tệp vừa sửa."""
    norm = path.replace("\\", "/")
    base = os.path.basename(norm)
    folder = os.path.dirname(norm)

    if base == ".env.example":
        # Thư mục gốc dùng cặp .env / .env.example (ngoại lệ cho Docker Compose)
        real = os.path.join(folder, ".env.local")
        if not os.path.exists(real):
            real = os.path.join(folder, ".env")
        return real, norm
    if base in (".env.local", ".env"):
        return norm, os.path.join(folder, ".env.example")
    return None


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
    if not path or ".env" not in os.path.basename(path.replace("\\", "/")):
        sys.exit(0)

    pair = pair_for(path)
    if not pair:
        sys.exit(0)
    real_path, example_path = pair

    real_keys = keys_of(real_path)
    example_keys = keys_of(example_path)
    if not real_keys and not example_keys:
        sys.exit(0)

    missing_in_example = sorted(real_keys - example_keys)
    missing_in_real = sorted(example_keys - real_keys)
    secret_in_public = sorted(
        k for k in (real_keys | example_keys)
        if PUBLIC_PREFIX.match(k) and SECRETISH.search(k)
    )

    if not (missing_in_example or missing_in_real or secret_in_public):
        sys.exit(0)

    folder = os.path.dirname(path.replace("\\", "/")) or "."
    msg = ["", f"[ViGov] Cặp tệp môi trường ở {folder} đang lệch:"]

    if missing_in_example:
        msg.append(
            f"  - CÓ giá trị thật nhưng THIẾU trong {os.path.basename(example_path)}: "
            + ", ".join(missing_in_example[:12])
            + (f" (+{len(missing_in_example) - 12})" if len(missing_in_example) > 12 else "")
        )
        msg.append(
            "    → Thêm TÊN biến + giá trị giữ chỗ (rỗng hoặc change-me-...) + một dòng "
            "chú thích. TUYỆT ĐỐI không sao giá trị thật sang."
        )
    if missing_in_real:
        msg.append(
            f"  - Có trong mẫu nhưng chưa đặt ở máy này: "
            + ", ".join(missing_in_real[:12])
            + (f" (+{len(missing_in_real) - 12})" if len(missing_in_real) > 12 else "")
        )
        msg.append("    → Đặt giá trị ở tệp giá trị thật, nếu không ứng dụng nhận chuỗi rỗng.")
    if secret_in_public:
        msg.append(
            "  - ⚠ Tên biến nghe như BÍ MẬT nhưng dùng tiền tố CÔNG KHAI: "
            + ", ".join(secret_in_public)
        )
        msg.append(
            "    → NEXT_PUBLIC_* và VITE_* được nhúng vào bundle gửi trình duyệt. "
            "Bí mật phải nằm ở backend."
        )

    msg += [
        "",
        "  Biến mới của backend còn phải khai trong libs/shared/src/config/configuration.ts.",
        "  Biến truyền qua Docker còn phải có trong docker-compose.yml và .env.example gốc.",
        "  → Luật: .claude/rules/critical/bi-mat-cau-hinh.md",
    ]
    print("\n".join(msg), file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
