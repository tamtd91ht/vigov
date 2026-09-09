"""PreToolUse hook — CHẶN thao tác có thể làm mất dữ liệu không phục hồi được.

Phạm vi: Bash | Edit | Write | MultiEdit

VÌ SAO: hồ sơ hành chính (văn bản, đơn thư, phản ánh, giải ngân) là TÀI LIỆU LƯU TRỮ có
thời hạn lưu theo quy định. Xoá một bản ghi ở đây không phải "dọn dữ liệu" — nó là tiêu
huỷ tài liệu, việc chỉ được làm theo quy trình hành chính, không phải bằng một lệnh Mongo.

Hook này chặn hai lớp:
  1. Lệnh shell phá hoại: rm -rf, git reset --hard, git clean, git push --force, mongosh
     có lệnh xoá, dropDatabase.
  2. Mã nguồn gọi API xoá cứng trên collection nghiệp vụ: deleteMany, deleteOne,
     findOneAndDelete, .drop(), updateMany bộ lọc rỗng.

Chặn được người dùng gỡ bằng cách nói rõ ý định — mọi thứ ở đây đều có cách làm an toàn
tương đương (xoá mềm, git restore, sao lưu trước).
"""

from __future__ import annotations

import json
import os
import re
import sys

# ---- Lớp 1: lệnh shell ----------------------------------------------------

DANGEROUS_BASH: list[tuple[str, str, str]] = [
    (r"""\brm\s+(-[a-zA-Z]*[rR][a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*[rR])\b""",
     "rm -rf",
     "Xoá thư mục không phục hồi được. Muốn xoá tệp tạm thì nêu rõ đường dẫn cụ thể."),
    (r"""\bgit\s+reset\s+--hard\b""",
     "git reset --hard",
     "Mất mọi thay đổi chưa commit. Dùng `git stash` để giữ lại."),
    (r"""\bgit\s+clean\b""",
     "git clean",
     "Xoá tệp chưa theo dõi — có thể xoá cả .env.local. Dùng `git status` rồi xoá tay."),
    (r"""\bgit\s+push\s+(--force\b|-f\b)""",
     "git push --force",
     "Ghi đè lịch sử của người khác. Dùng `--force-with-lease` nếu thật cần, sau khi hỏi."),
    (r"""\bgit\s+(branch\s+-D|push\s+\S+\s+--delete)\b""",
     "xoá nhánh",
     "Xoá nhánh có thể mất công việc chưa merge. Xác nhận với người dùng trước."),
    (r"""\bdropDatabase\s*\(|\bdb\.dropDatabase\b""",
     "dropDatabase",
     "Xoá toàn bộ cơ sở dữ liệu."),
    (r"""\bmongosh?\b[^|]*\b(drop|deleteMany|deleteOne|remove)\s*\(""",
     "lệnh xoá qua mongosh",
     "Sửa dữ liệu thật bằng mongosh không để lại vết. Đi qua API để được ghi nhật ký."),
    (r"""\b(mongo|mongosh)\b.*--eval\b""",
     "mongosh --eval",
     "Chạy mã trực tiếp trên cơ sở dữ liệu, không có nhật ký thao tác."),
    (r"""\bseed(:fresh)?\b.*--fresh\b|\bnpm\s+run\s+seed:fresh\b""",
     "seed --fresh",
     "Dựng lại dữ liệu từ trắng. CHỈ dùng trên máy phát triển. Xác nhận môi trường trước."),
    (r"""\btruncate\b|\bTRUNCATE\s+TABLE\b|\bDROP\s+(TABLE|DATABASE|SCHEMA)\b""",
     "DROP / TRUNCATE",
     "Xoá cấu trúc và dữ liệu."),
    (r"""\bdocker\s+(compose\s+)?down\s+[^\n]*(-v|--volumes)\b""",
     "docker compose down -v",
     "Xoá volume — mất toàn bộ dữ liệu MongoDB trong container."),
    (r"""\bdocker\s+volume\s+(rm|prune)\b|\bdocker\s+system\s+prune\b""",
     "xoá docker volume",
     "Mất dữ liệu MongoDB / RabbitMQ trong volume."),
    (r"""\bgit\s+add\s+(-f|--force)\b[^\n]*\.env(?!\.example)""",
     "git add -f tệp .env",
     ".gitignore chặn tệp env là ĐÚNG THIẾT KẾ. Chỉ .env.example được commit."),
]

# ---- Lớp 2: mã nguồn xoá cứng --------------------------------------------

# Collection nghiệp vụ — dữ liệu có giá trị pháp lý, không được xoá cứng.
BUSINESS_HINT = re.compile(
    r"(feedback|document|dossier|task|disbursement|user|audit|content|notification|"
    r"file|staff|citizen|workflow|setting|catalog|report)",
    re.IGNORECASE,
)

HARD_DELETE: list[tuple[str, str]] = [
    (r"""\.deleteMany\s*\(""", "deleteMany"),
    (r"""\.deleteOne\s*\(""", "deleteOne"),
    (r"""\.findOneAndDelete\s*\(""", "findOneAndDelete"),
    (r"""\.findByIdAndDelete\s*\(""", "findByIdAndDelete"),
    (r"""\.findByIdAndRemove\s*\(""", "findByIdAndRemove"),
    (r"""\.remove\s*\(\s*\)""", ".remove()"),
    (r"""\.collection\s*\.\s*drop\s*\(""", "collection.drop()"),
    (r"""\.dropIndexes?\s*\(""", "dropIndex(es)"),
]

# updateMany / deleteMany với bộ lọc rỗng
EMPTY_FILTER = re.compile(r"""\.(updateMany|deleteMany)\s*\(\s*\{\s*\}""")

SKIP_FRAGMENTS = (
    "/test/", "/tests/", "/__tests__/", "/fixtures/", "/mocks/", "/.claude/",
    "/node_modules/", "/dist/", ".spec.", ".test.",
)


def read_input() -> dict:
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


def should_skip(path: str) -> bool:
    norm = path.replace("\\", "/").lower()
    return any(f in norm for f in SKIP_FRAGMENTS)


def new_content(tool_input: dict) -> str:
    if "content" in tool_input:
        return tool_input.get("content") or ""
    parts: list[str] = []
    if tool_input.get("new_string") is not None:
        parts.append(tool_input.get("new_string") or "")
    for edit in tool_input.get("edits") or []:
        parts.append(edit.get("new_string") or "")
    return "\n".join(parts)


def block(lines: list[str]) -> None:
    print("\n".join([""] + lines), file=sys.stderr)
    sys.exit(2)


def check_bash(command: str) -> None:
    for pattern, name, why in DANGEROUS_BASH:
        if re.search(pattern, command):
            block([
                f"[ViGov · CHẶN] lệnh có thể mất dữ liệu: {name}",
                f"  Lệnh: {command[:160]}",
                f"  {why}",
                "",
                "  ViGov là hệ thống của cơ quan nhà nước — hồ sơ hành chính là tài liệu",
                "  lưu trữ có thời hạn theo quy định. Nếu THẬT SỰ cần lệnh này, nói rõ với",
                "  người dùng nó sẽ ảnh hưởng những gì và chờ xác nhận tường minh.",
                "  → Luật: .claude/rules/critical/bao-toan-du-lieu.md",
            ])


def check_code(content: str, path: str) -> None:
    hits: list[str] = []

    for pattern, name in HARD_DELETE:
        for m in re.finditer(pattern, content):
            # Lấy ngữ cảnh quanh chỗ khớp để đoán có phải collection nghiệp vụ
            start = max(0, m.start() - 120)
            context = content[start:m.end() + 60]
            if BUSINESS_HINT.search(context) or BUSINESS_HINT.search(path):
                hits.append(f"{name} trên dữ liệu nghiệp vụ")

    for m in re.finditer(EMPTY_FILTER, content):
        hits.append(f"{m.group(1)} với bộ lọc rỗng — tác động MỌI bản ghi")

    if hits:
        block([
            f"[ViGov · CHẶN] xoá cứng dữ liệu nghiệp vụ trong {os.path.basename(path)}",
            *[f"  - {h}" for h in dict.fromkeys(hits)][:6],
            "",
            "  Hồ sơ hành chính (văn bản, đơn thư, phản ánh, giải ngân, tài khoản) là",
            "  TÀI LIỆU LƯU TRỮ. Cách làm đúng là XOÁ MỀM:",
            "    - đặt deletedAt / deletedBy / deleteReason",
            "    - loại bản ghi đã xoá khỏi mọi truy vấn đọc (deletedAt: null)",
            "    - ghi vết ai xoá, lúc nào, vì sao",
            "",
            "  Ngoại lệ hợp pháp duy nhất: công dân yêu cầu xoá dữ liệu cá nhân theo",
            "  NĐ 13/2023 — khi đó ẨN DANH, không xoá cứng.",
            "  → Luật: .claude/rules/critical/bao-toan-du-lieu.md",
            "  → Kỹ năng: .claude/skills/che-du-lieu-ca-nhan/SKILL.md",
        ])


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
    tool_input = data.get("tool_input") or data.get("input") or {}

    if tool == "Bash":
        command = tool_input.get("command") or ""
        if command:
            check_bash(command)
        sys.exit(0)

    if tool in ("Edit", "Write", "MultiEdit"):
        path = tool_input.get("file_path") or ""
        if not path or should_skip(path):
            sys.exit(0)
        content = new_content(tool_input)
        if content:
            check_code(content, path)

    sys.exit(0)


if __name__ == "__main__":
    main()
