"""SessionStart hook — nhắc ngữ cảnh ViGov đầu mỗi phiên.

Mục tiêu: <= 8 dòng, nói đúng ba thứ người viết mã cần biết ngay:
  1. Đây là ứng dụng của cơ quan nhà nước (nhắc một dòng, không giảng bài)
  2. Đang ở nhánh nào — dự án CHỈ dùng main, ở nhánh khác thì cảnh báo
  3. Còn task nào đang dở

Ràng buộc thiết kế:
  - Chỉ dùng thư viện chuẩn Python, không phụ thuộc ngoài
  - Nhanh (<200ms) — không được làm chậm lúc mở phiên
  - Thất bại im lặng — hook lỗi thì phiên vẫn chạy bình thường
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

GIT_TIMEOUT = 3
MAIN_BRANCHES = ("main", "master", "prod")


def consume_stdin() -> dict:
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


def find_project_root(start: str) -> str | None:
    """Đi ngược lên tìm thư mục có .claude — đó là gốc dự án."""
    d = os.path.abspath(start)
    for _ in range(6):
        if os.path.isdir(os.path.join(d, ".claude")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    return None


def git_branch(cwd: str) -> str | None:
    try:
        r = subprocess.run(
            ["git", "symbolic-ref", "--short", "HEAD"],
            capture_output=True, text=True, timeout=GIT_TIMEOUT, cwd=cwd,
        )
        return r.stdout.strip() if r.returncode == 0 else None
    except Exception:
        return None


def task_summary(root: str) -> tuple[int, list[str]]:
    """(số task pending, danh sách mã task đang in-progress)."""
    path = os.path.join(root, "pending-tasks.json")
    if not os.path.exists(path):
        return 0, []
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return 0, []
    if not isinstance(data, list):
        return 0, []
    pending = sum(1 for t in data if isinstance(t, dict) and t.get("status") == "pending")
    doing = [
        str(t.get("id", "?"))
        for t in data
        if isinstance(t, dict) and t.get("status") == "in-progress"
    ]
    return pending, doing


def bypass_still_on(root: str) -> bool:
    """CITIZEN_OTP_BYPASS_CODE còn giá trị = còn một lối vào không qua xác thực thật.

    Chỉ kiểm CÓ hay KHÔNG có giá trị — tuyệt đối không đọc và không in giá trị đó.
    """
    for rel in (os.path.join("backend", ".env.local"), ".env"):
        path = os.path.join(root, rel)
        if not os.path.exists(path):
            continue
        try:
            with open(path, encoding="utf-8", errors="ignore") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("CITIZEN_OTP_BYPASS_CODE="):
                        value = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if value:
                            return True
        except Exception:
            continue
    return False


def _utf8_streams() -> None:
    """Terminal Windows mac dinh cp1252 — khong in duoc tieng Viet. Doi sang UTF-8."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def main() -> None:
    _utf8_streams()
    consume_stdin()
    cwd = os.path.abspath(os.getcwd())
    root = find_project_root(cwd) or cwd

    lines: list[str] = [
        "[ViGov] Ứng dụng của CƠ QUAN NHÀ NƯỚC — dữ liệu cá nhân công dân + hồ sơ có "
        "giá trị pháp lý. Cẩn thận trước, nhanh sau. Luật: .claude/rules/critical/",
    ]

    branch = git_branch(root)
    if branch:
        if branch in MAIN_BRANCHES:
            lines.append(f"[ViGov] Nhánh: {branch} (đúng — dự án chỉ dùng một nhánh)")
        else:
            lines.append(
                f"[ViGov] ⚠ Đang ở nhánh '{branch}', không phải main. Dự án này CHỈ dùng "
                "main — merge về main (git merge --ff-only) rồi push main. Tách nhánh chỉ "
                "khi người dùng quyết hoặc đã chốt đồng ý."
            )

    pending, doing = task_summary(root)
    if doing:
        lines.append(f"[ViGov] Task đang dở: {', '.join(doing)} — xem /task-hien-tai")
    if pending:
        lines.append(f"[ViGov] {pending} task chưa bắt đầu.")

    if bypass_still_on(root):
        lines.append(
            "[ViGov] ⚠ CITIZEN_OTP_BYPASS_CODE đang BẬT — lối vào không qua xác thực "
            "thật. Không nới AUTH_THROTTLE. Phải để trống trước production."
        )

    print("\n" + "\n".join(lines) + "\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
