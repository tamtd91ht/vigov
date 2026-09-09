# Bộ não `.claude` của ViGov — cách hoạt động và cách mở rộng

Thư mục này là **khuôn khổ** cho mọi việc viết mã trong dự án ViGov. Mục đích: về lâu
dài, dù ai làm, dù cách bao nhiêu tháng, mã vẫn không trượt ra khỏi những gì một ứng
dụng của **cơ quan nhà nước** buộc phải giữ.

---

## Bốn tầng, bốn cách hoạt động

| Tầng | Ở đâu | Nạp khi nào | Cưỡng chế bằng gì |
|---|---|---|---|
| **Bối cảnh** | `CLAUDE.md` | Mọi phiên, tự động | Không — định hướng |
| **Luật** | `rules/critical/` (8 tệp) | Mọi phiên, tự động | Một phần bằng hook |
| **Kỹ năng** | `skills/<tên>/SKILL.md` (26) | Lười — tự bật khi từ khoá khớp | Không — hướng dẫn |
| **Hook** | `hooks/*.py` (7) | Trước / sau khi dùng tool | **Chặn hoặc nhắc thật** |

Thêm hai tầng hỗ trợ:

- **Agent** (`agents/`, 9) — vai trò chuyên môn, gọi khi việc lớn hoặc cần rà diện rộng
- **Lệnh** (`commands/`, 17) — quy trình gõ được bằng `/tên-lệnh`
- **Quy trình** (`workflows/`, 7) — danh sách bước cho từng loại việc
- **Dữ liệu** (`data/`, 4) — thuật ngữ, hằng số, bản đồ module, tham chiếu pháp lý

---

## Hook — lớp duy nhất thật sự chặn

| Hook | Sự kiện | Hành vi | Chặn gì |
|---|---|---|---|
| `session_start.py` | SessionStart | in ngữ cảnh | Nhắc đây là app nhà nước · nhánh hiện tại · task đang dở · cảnh báo `CITIZEN_OTP_BYPASS_CODE` còn bật |
| `secret_scan.py` | PreToolUse (Edit/Write) | **CHẶN** | Secret viết cứng trong mã · giá trị thật lọt vào `.env.example` |
| `pii_guard.py` | PreToolUse (Edit/Write) | **CHẶN** | `console.log`/`print` dữ liệu cá nhân · số điện thoại / CCCD thật viết cứng |
| `data_safety_guard.py` | PreToolUse (Bash + Edit/Write) | **CHẶN** | `rm -rf` · `git reset --hard` · `git push --force` · `dropDatabase` · `mongosh` xoá · `docker volume rm` · `deleteMany`/`deleteOne` trên dữ liệu nghiệp vụ · `updateMany` bộ lọc rỗng |
| `rbac_audit_guard.py` | PostToolUse | nhắc | Route mới thiếu `@RequirePermission` / `@Public()` (đường `citizen/**` được miễn) |
| `hardcode_guard.py` | PostToolUse | nhắc | Tên xã cụ thể · URL máy chủ · số ngày SLA · toạ độ · nhãn trạng thái nằm ngoài `config/` |
| `env_sync_guard.py` | PostToolUse | nhắc | `.env.local` ↔ `.env.example` lệch tên biến · secret sau tiền tố `NEXT_PUBLIC_`/`VITE_` |

**Hook bị chặn không có nghĩa là "thử cách khác cho lọt".** Mỗi thông báo chặn đều nói
cách làm đúng tương đương. Nếu thật sự cần làm việc bị chặn, nói với người dùng nó ảnh
hưởng gì và chờ xác nhận tường minh.

### Hiệu chỉnh — vì sao hook không ồn

Hook đã được đo trên mã nguồn thật của dự án trước khi chốt:

- `secret_scan.py` — **0 báo động sai** trên cả 4 tệp `.env.example` thật. Quét theo
  **tên biến**, không theo độ dài giá trị (nếu theo độ dài thì `TZ=Asia/Ho_Chi_Minh` và
  `API_PROXY_TARGET=http://backend:3001` đều bị chặn oan).
- `hardcode_guard.py` — nhắc **6/342 tệp** (1,8%), 5 trong 6 là phát hiện thật. Đã cố ý
  **bỏ** mẫu mã màu hex: nó nhắc trên 15 tệp biểu đồ, và một hook ồn là một hook bị tắt.
- `rbac_audit_guard.py` — miễn đường `citizen/**` vì công dân **không có vai trò**;
  chúng cách ly bằng `citizenPhone` từ phiên, không bằng RBAC.

Sửa hook thì **phải đo lại** trên mã thật. Báo động sai làm người dùng tắt hook, và khi
đó ta mất cả lớp bảo vệ — tệ hơn là không có hook.

### Yêu cầu môi trường

`python` phải có trong `PATH` (đã kiểm với Python 3.14). Hook chỉ dùng thư viện chuẩn.

Trên Windows, terminal mặc định là cp1252 nên **không in được tiếng Việt** — mỗi hook có
hàm `_utf8_streams()` gọi ở đầu `main()` để đổi `stdout`/`stderr` sang UTF-8. Viết hook
mới thì phải có hàm đó, nếu không hook sẽ chết với `UnicodeEncodeError`.

---

## Cách mở rộng

### Thêm một LUẬT (mức tối quan trọng)

Chỉ thêm khi: vi phạm nó gây **hậu quả không sửa được** (lộ dữ liệu công dân, mất tài
liệu lưu trữ, vi phạm pháp luật). Mọi thứ khác là **kỹ năng**, không phải luật — vì luật
nạp vào mọi phiên và tốn context vĩnh viễn.

1. Tạo `rules/critical/<ten>.md`, **trần 120 dòng**
2. Định dạng: bảng MUST / MUST NOT + mục "Điều kiện DỪNG"
3. Thêm dòng vào bảng luật ở `CLAUDE.md` **và** `rules/_INDEX.md`
4. Cân nhắc viết hook cưỡng chế — luật không có cưỡng chế sẽ bị bỏ qua dần

### Thêm một KỸ NĂNG

1. Tạo `skills/<ten>/SKILL.md`, **trần 250 dòng**
2. Frontmatter YAML bắt buộc:
   ```yaml
   ---
   name: <ten-kebab-case>
   description: Dùng khi <việc gì>. Kích hoạt bởi: <danh sách từ khoá tiếng Việt VÀ tiếng Anh>
   ---
   ```
   Phần "Kích hoạt bởi" quyết định skill có tự bật hay không — liệt kê từ khoá **thật sự
   xuất hiện** khi người ta nói về việc đó, cả tiếng Việt và tiếng Anh.
3. Nội dung: bảng MUST / MUST NOT + mã tối thiểu + dẫn chiếu chéo
4. Thêm vào `rules/_INDEX.md` và nhóm tương ứng ở `CLAUDE.md`

### Thêm một HOOK

1. Viết `hooks/<ten>.py` — **thư viện chuẩn, tự chứa** (hook được `exec` nên không import
   được module bên cạnh)
2. Bắt buộc có `_utf8_streams()` gọi đầu `main()`
3. Đọc JSON từ stdin: `tool_name`, `tool_input`. Bọc trong `try/except` — **hook lỗi
   không được chặn công việc**
4. Chặn: `exit(2)` + thông báo trên `stderr`. Nhắc (PostToolUse): cũng `exit(2)`. Im lặng:
   `exit(0)`
5. Thông báo phải nói **cách làm đúng**, không chỉ nói "bị cấm"
6. **Đo trên mã thật** trước khi thêm vào `settings.json` — xem mục Hiệu chỉnh ở trên
7. Đăng ký trong `settings.json` theo mẫu bootstrap đang dùng
8. Thêm dòng vào bảng hook ở tệp này và `rules/_INDEX.md`

### Thêm một LỆNH hoặc AGENT

- Lệnh: `commands/<ten>.md`, trần 150 dòng, frontmatter `description` +
  `argument-hint` + `allowed-tools`. Thêm vào mục LỆNH ở `CLAUDE.md`.
- Agent: `agents/<ten>.md`, trần 200 dòng, frontmatter `name` + `description` + `tools`.
  Thêm vào `agents/_ROUTING.md`.

---

## Nguyên tắc giữ bộ não gọn

| Nguyên tắc | Vì sao |
|---|---|
| **Không nhân bản nội dung** — luôn dẫn chiếu chéo | Hai bản của một luật là hai bản sẽ lệch nhau |
| **Luật nạp sẵn phải ít và ngắn** | Mỗi dòng là context trả tiền ở mọi phiên |
| **Bảng thay cho văn xuôi** | Đọc nhanh, khó viết lan |
| **Không vẽ cây quyết định ASCII** | Tốn dòng, không ai đọc |
| **Nêu hậu quả, không chỉ nêu quy tắc** | "Không log số điện thoại" yếu hơn "log đi vào docker logs và bản sao lưu" |
| **Dẫn chiếu mã thật** (tệp:dòng, tên hàm) | Luật trừu tượng bị bỏ qua; luật trỏ vào mã thì kiểm được |
| **Ghi cả nợ kỹ thuật đã biết** | Người sau biết chỗ nào đang sai, không tưởng là mẫu để noi theo |

Rà bộ não định kỳ: tệp nào vượt trần dòng? luật nào không ai dùng? hook nào ồn?
skill nào không bao giờ tự bật (từ khoá sai)?

---

## Nợ kỹ thuật bộ não đang theo dõi

| Nợ | Nơi | Gom về |
|---|---|---|
| `maskPhone` tồn tại **3 bản** | `users.service.ts:112` · `feedback.service.ts:667` · `dossiers.service.ts:77` | `libs/shared/src/privacy/mask.ts` |
| SLA mặc định lặp **2 nơi** ngoài nguồn chuẩn | `settings/settings.service.ts` · `seed.ts` (nguồn chuẩn: `admin-web/src/config/sla.config.ts`) | Một nguồn |
| Toạ độ trung tâm viết cứng **3 nơi** | `geo.provider.ts` (`DAI_THANG_CENTER`) · `zalo-miniapp/src/services/zalo.ts` · `mobile/lib/services/device/location_service.dart` | Cấu hình bản đồ |
| Route thiếu khai quyền tường minh | `auth.controller.ts` (2) · `catalogs.controller.ts` (6) · `files.controller.ts` (2) · `geo.controller.ts` (3) · `notification.controller.ts` (1) | Khai `@RequirePermission` hoặc `@Public()` kèm lý do |

Trả nợ khi **đang chạm vào** chỗ đó — không refactor ngoài phạm vi.

---

## Đọc gì trước

1. `CLAUDE.md` — bối cảnh và hành vi (tự nạp)
2. `rules/_INDEX.md` — tra luật và kỹ năng theo việc đang làm
3. `workflows/_INDEX.md` — quy trình theo loại việc
4. `data/glossary.md` — khi gặp thuật ngữ hành chính lạ
