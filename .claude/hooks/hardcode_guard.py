"""PostToolUse hook — nhắc khi giá trị lẽ ra phải ở cấu hình lại nằm trong mã.

Phạm vi: Edit | Write | MultiEdit trên mã nguồn của 4 module, TRỪ thư mục config/,
mocks/, seed-data/, test.

VÌ SAO: ViGov chạy một mã nguồn cho NHIỀU xã/phường. Mỗi xã có tên riêng, cơ quan cấp
trên riêng, danh mục riêng, SLA riêng, toạ độ riêng. Một chuỗi "UBND xã Tân Phú" nằm
trong component là một lần phải sửa mã và phát hành lại cho mỗi khách hàng mới.

Đây là NHẮC (không chặn) vì ranh giới giữa "hằng số kỹ thuật" và "cấu hình theo khách"
đôi khi cần người quyết định. Nhắc để không bỏ sót, không để tự động chặn việc hợp lệ.
"""

from __future__ import annotations

import json
import os
import re
import sys

# Chữ hoa tiếng Việt, liệt kê tường minh.
#
# VÌ SAO KHÔNG DÙNG [A-ZÀ-Ỹ]: khối Latin Extended Additional xen kẽ chữ hoa và chữ
# thường, nên dải À-Ỹ (U+00C0–U+1EF8) chứa LUÔN chữ thường (ã, ờ, ệ…). Dùng dải đó thì
# "UBND xã đã tiếp nhận…" bị nhận là có tên riêng, trong khi "đã" chỉ là hư từ.
UPPER_VI = (
    r"""[A-ZĐÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊ"""
    r"""ÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ]"""
)

# Chuỗi mở đầu bằng "VD:" / "Ví dụ" là ví dụ minh hoạ trong biểu mẫu, không phải cấu hình.
EXAMPLE_PREFIX = re.compile(r"""["'`]\s*(VD|V[íi] d[ụu])\s*[:.]""", re.IGNORECASE)

# Chỉ nhắc những giá trị RIÊNG CỦA MỘT XÃ. Nhãn chung cho mọi xã ("Chủ tịch UBND xã",
# "Lãnh đạo UBND xã") KHÔNG bị nhắc — chúng đúng ở mọi nơi triển khai.
#
# Mã màu hex đã bị bỏ khỏi hook có chủ ý: biểu đồ cần màu tường minh, và nhắc trên 15
# tệp biểu đồ chỉ làm người dùng tắt hook. Việc rà màu để cho `/kiem-tra-hardcode`.
PATTERNS: list[tuple[str, str, str]] = [
    (
        # UBND/HĐND + cấp + TÊN RIÊNG (chữ hoa đầu) → riêng của một xã.
        # Không khớp "UBND xã đã tiếp nhận…" vì "đã" viết thường.
        r"""(?:UBND|H[ĐD]ND|U[ỷỳý] ban nh[âa]n d[âa]n|H[ộo]i [đd][ồo]ng nh[âa]n d[âa]n)\s+"""
        r"""(?:x[ãa]|ph[ưu][ờo]ng|th[ịi] tr[ấa]n|huy[ệe]n|t[ỉi]nh|qu[ậa]n)\s+"""
        + UPPER_VI + r"""\S+""",
        "tên xã/phường CỤ THỂ viết cứng",
        "Đọc từ appConfig.org.name (NEXT_PUBLIC_ORG_NAME / VITE_ORG_NAME)",
    ),
    (
        # URL tuyệt đối tới máy chủ của HỆ THỐNG. Loại trừ: máy cục bộ, chuỗi giữ chỗ,
        # và endpoint cố định của nền tảng bên thứ ba (FCM, Zalo, YouTube, tile bản đồ,
        # CDN) — những địa chỉ đó do nhà cung cấp quy định, không đổi theo từng xã.
        r"""["'`]https?://(?![^"'`\n\s/]*(?:localhost|127\.0\.0\.1|0\.0\.0\.0|host[:/]|"""
        r"""youtube|ytimg|youtu\.be|vimeo|openfreemap|openstreetmap|tile|maplibre|"""
        r"""unpkg|cdnjs|jsdelivr|zalo|zdn\.vn|googleapis|gstatic|w3\.org|schema))"""
        r"""(?!<)[^"'`\n\s]{4,}["'`]""",
        "URL máy chủ viết cứng",
        "Đọc từ appConfig.api.baseUrl / *_URL trong cấu hình; mặc định phải là localhost hoặc rỗng",
    ),
    (
        r"""\b(intakeDays|resolveDays|slaDays|deadlineDays|warnBefore)\s*[:=]\s*\d+""",
        "số ngày SLA viết cứng",
        "Đọc từ sla.config.ts (defaultSlaRules) — cán bộ sửa được từ trang Cấu hình",
    ),
    (
        r"""status\s*===?\s*["'](moi|dang|cho|qua|xong|dangxl|choduyet)["']\s*\?\s*["'][^"']*[À-ỹ]""",
        "nhãn trạng thái tiếng Việt viết cứng cạnh khoá",
        "Đọc nhãn từ status.config.ts — dữ liệu chỉ mang KHOÁ, nhãn nằm ở cấu hình",
    ),
    (
        r"""\b(lat|lng|latitude|longitude|centerLat|centerLng)\s*[:=]\s*(1[0-9]|2[0-3])\.\d{3,}""",
        "toạ độ bản đồ viết cứng",
        "Đọc từ map.config.ts / biến môi trường — mỗi xã một toạ độ trung tâm",
    ),
    (
        r"""["'`]0(?:2\d{1,2}|1[89]00)[\s.\-]?\d{4,8}["'`]""",
        "số điện thoại cơ quan viết cứng",
        "Đọc từ cấu hình đơn vị — mỗi xã một số",
    ),
]

# Thư mục ĐƯỢC PHÉP chứa những giá trị này (chúng chính là nơi khai cấu hình).
ALLOWED_FRAGMENTS = (
    "/config/", "/mocks/", "/seed-data/", "/test/", "/tests/", "/__tests__/",
    "/fixtures/", "/.claude/", "/node_modules/", "/dist/", "/build/", "/docs/",
    "/plans/", "/deploy/", ".spec.", ".test.", ".config.ts",
    "categories.ts", "globals.css",
)

WATCHED_ROOTS = ("admin-web/", "zalo-miniapp/", "backend/")
WATCHED_EXTENSIONS = (".ts", ".tsx", ".js", ".jsx")


def read_input() -> dict:
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


def in_scope(path: str) -> bool:
    norm = path.replace("\\", "/")
    if not norm.endswith(WATCHED_EXTENSIONS):
        return False
    if any(f in norm for f in ALLOWED_FRAGMENTS):
        return False
    return any(root in norm for root in WATCHED_ROOTS)


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
    if not path or not in_scope(path):
        sys.exit(0)

    content = new_content(tool_input)
    if not content:
        sys.exit(0)

    findings: list[tuple[str, str, str]] = []
    for pattern, label, fix in PATTERNS:
        m = next(
            (
                m
                for m in re.finditer(pattern, content)
                # Bỏ chuỗi ví dụ minh hoạ trong biểu mẫu ("VD: UBND huyện …")
                if not EXAMPLE_PREFIX.search(
                    content[max(0, m.start() - 30) : m.start()]
                )
            ),
            None,
        )
        if m:
            snippet = m.group(0).replace("\n", " ").strip()
            if len(snippet) > 70:
                snippet = snippet[:67] + "…"
            findings.append((label, snippet, fix))

    if not findings:
        sys.exit(0)

    msg = ["", f"[ViGov] {os.path.basename(path)} — giá trị lẽ ra thuộc cấu hình:"]
    for label, snippet, fix in findings[:5]:
        msg.append(f"  - {label}: {snippet}")
        msg.append(f"    → {fix}")
    msg += [
        "",
        "  ViGov chạy MỘT mã nguồn cho NHIỀU xã/phường. Giá trị theo khách hàng nằm",
        "  trong mã là một lần sửa mã + phát hành lại cho mỗi xã mới.",
        "  Hằng số KỸ THUẬT (không phụ thuộc khách hàng) thì được — đặt là const có tên",
        "  rõ ở đầu tệp, không rải số ma thuật.",
        "  → Luật: .claude/rules/critical/khong-hardcode.md",
    ]
    print("\n".join(msg), file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
