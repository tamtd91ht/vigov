# ViGov — quy ước cho AI agent

---

# ⚠ ĐÂY LÀ ỨNG DỤNG CỦA CƠ QUAN NHÀ NƯỚC

ViGov là nền tảng **Điều hành số cấp Xã/Phường** do UBND xã/phường vận hành. Mọi dòng mã
trong dự án này chạm tới một trong ba thứ sau:

1. **Dữ liệu cá nhân của công dân** — số điện thoại, họ tên, địa chỉ, ảnh hiện trường,
   dữ liệu thẻ căn cước, nội dung đơn thư. Chịu ràng buộc **Nghị định 13/2023/NĐ-CP**
   về bảo vệ dữ liệu cá nhân.
2. **Hồ sơ hành chính có giá trị pháp lý** — văn bản đến/đi, đơn thư, phiếu phản ánh,
   quyết định giải ngân. Đây là **tài liệu lưu trữ** có thời hạn lưu theo quy định:
   **không được xoá cứng, không được sửa lặng lẽ**.
3. **Uy tín của một cơ quan công quyền** — hiển thị sai tên xã, con số thống kê lệch,
   một câu tiếng Việt sai chính tả đều là sự cố có người phải giải trình.

**MỌI THỨ KHI CODE ĐỀU PHẢI CẨN THẬN.** Cụ thể:

| Nguyên tắc | Nghĩa khi viết mã |
|---|---|
| **Cẩn thận trước, nhanh sau** | Không đoán nghiệp vụ. Không "tạm thế này rồi sửa sau". Không đổi hành vi nghiệp vụ khi không được yêu cầu. |
| **Nói rõ giả định** | Nêu giả định trước khi viết mã. Nghiệp vụ hành chính có nhiều biến thể theo địa phương — chọn thầm là chọn sai. |
| **Không phá dữ liệu** | Không xoá cứng bản ghi nghiệp vụ, không `deleteMany`, không migration mất dữ liệu. Xoá mềm + ghi vết. |
| **Mọi thao tác ghi phải có vết** | Ai làm, làm gì, lúc nào, từ IP nào. Nhật ký giữ tối thiểu 12 tháng. |
| **Mặc định đóng** | Endpoint mới phải khai quyền tường minh. Tệp nghiệp vụ mới phải `isPrivate = true`. Trường dữ liệu cá nhân mặc định che. |
| **Cách ly dữ liệu công dân** | Công dân chỉ được thấy đúng dữ liệu của chính mình. Định danh công dân chỉ là OTP — coi là danh tính **yếu**. |
| **Không hardcode** | Một mã nguồn chạy cho nhiều xã. Tên đơn vị, SLA, danh mục, toạ độ, URL đều ở cấu hình. |
| **Tiếng Việt hành chính đúng chuẩn** | Sai chính tả, sai thuật ngữ (phản ánh ≠ khiếu nại ≠ tố cáo) là lỗi nghiệp vụ, không phải lỗi nhỏ. |
| **Kiểm chứng, đừng chỉ khai báo** | `npm run check:all` + test liên quan phải chạy thật. Báo "đã xong" khi đã chạy và thấy xanh. |
| **Không tự chốt câu hỏi mở của khách** | ~27 câu hỏi mở ở `ESTIMATE_TECHNICAL.md` là quyết định của khách hàng. |

**Khi phải chọn giữa "làm cho nhanh" và "làm cho đúng" — luôn chọn đúng, rồi nói cho
người dùng biết nó tốn thêm bao nhiêu.**

## Git: CHỈ DÙNG NHÁNH `main`

Dự án này làm việc trên **một nhánh duy nhất là `main`**. Commit và push thẳng vào `main`.

**Tách nhánh chỉ xảy ra trong đúng hai trường hợp:**

1. Người dùng **tự quyết định** tách và nói ra;
2. Agent **đề nghị** tách, nêu rõ vì sao, và người dùng **chốt đồng ý**.

Ngoài hai trường hợp đó, tự tạo nhánh là **sai**. Nó đẩy việc merge sang cho người dùng —
việc họ không yêu cầu — và làm chậm đúng thứ họ vừa nhờ đưa lên.

Đặc biệt: **"cho cẩn thận" KHÔNG phải lý do để tự tách nhánh.** Thấy thay đổi có rủi ro
thì **nói ra rủi ro đó** rồi làm theo yêu cầu; đừng tự đổi sang cách làm khác. Một quy ước
do agent tự nghĩ ra không được phép chặn một yêu cầu tường minh của người dùng.

Đang lỡ ở nhánh khác: `git merge --ff-only <nhánh>` về `main` rồi push `main`.

## Bộ não `.claude/` — khuôn khổ bắt buộc

Toàn bộ luật, kỹ năng, quy trình và chốt cưỡng chế nằm ở `.claude/`:

| Nơi | Nội dung |
|---|---|
| `.claude/CLAUDE.md` | Bối cảnh, kiến trúc, hành vi khi làm việc (tự nạp mọi phiên) |
| `.claude/rules/critical/` | **8 luật tối quan trọng**, nạp sẵn: dữ liệu cá nhân · cách ly công dân · RBAC · nhật ký · bảo toàn dữ liệu · bí mật cấu hình · không hardcode · tiếng Việt hành chính |
| `.claude/skills/` | 25 kỹ năng, tự bật theo từ khoá |
| `.claude/hooks/` | **7 hook cưỡng chế thật** — chặn secret, chặn log dữ liệu cá nhân, chặn xoá dữ liệu, nhắc thiếu quyền / hardcode / lệch env |
| `.claude/workflows/` | 7 quy trình theo loại việc |
| `.claude/agents/` · `.claude/commands/` | 9 agent · 17 lệnh `/` |
| `.claude/data/` | Thuật ngữ hành chính · hằng số · bản đồ module · tham chiếu pháp lý |

Tra cứu: **`.claude/rules/_INDEX.md`**. Cách mở rộng bộ não: **`.claude/README.md`**.

Hook chặn một việc thì **không tìm cách khác cho lọt** — thông báo chặn luôn nói cách
làm đúng tương đương. Thật sự cần làm việc bị chặn thì nói rõ hậu quả với người dùng và
chờ xác nhận tường minh.

---

## Biến môi trường: `.env.local` (giá trị thật) ↔ `.env.example` (mẫu)

Mỗi module có **hai** tệp cấu hình, vai trò khác hẳn nhau:

| Tệp | Nội dung | Git |
|---|---|---|
| `.env.local` | Giá trị **thật** của máy đang chạy: mật khẩu, chuỗi kết nối, khoá API | ❌ Không bao giờ commit |
| `.env.example` | **Mẫu**: đủ tên biến, nhưng giá trị là giữ chỗ (rỗng hoặc `change-me-...`) | ✅ Commit |

Vị trí:

```
backend/.env.local        backend/.env.example
admin-web/.env.local      admin-web/.env.example
zalo-miniapp/.env.local   zalo-miniapp/.env.example
.env                      .env.example          ← NGOẠI LỆ, xem mục dưới
```

### Quy tắc bắt buộc khi ghi vào hai tệp này

1. **Thêm biến mới → sửa CẢ HAI tệp.** Giá trị thật vào `.env.local`, tên biến kèm
   giá trị giữ chỗ và một dòng chú thích vào `.env.example`. Sửa một bên là
   `.env.example` mất đồng bộ, người tiếp theo clone về sẽ thiếu biến mà không biết.

2. **Không bao giờ đặt giá trị thật vào `.env.example`.** Không mật khẩu, không
   chuỗi kết nối có credential, không khoá API, không IP máy chủ nội bộ. Dùng
   `change-me-...`, để trống, hoặc `localhost`.

3. **Không đọc `.env.local` rồi in nội dung ra chat, commit message, hay tài liệu.**
   Tệp này chứa credential thật. Cần dẫn chiếu thì nói tên biến, không nói giá trị.

4. **Không tự tạo lại `.env`** ở `backend/`, `admin-web/`, `zalo-miniapp/`.
   Ứng dụng đọc `.env.local`; để lẫn cả hai sẽ gây lệch cấu hình khó truy.

5. **Không `git add -f` bất kỳ tệp `.env*` nào** ngoài `.env.example`.
   `.gitignore` đã chặn — nếu thấy git bỏ qua một tệp env, đó là đúng thiết kế.

6. **Đổi giá trị mặc định nhạy cảm thì ghi vào `SECURITY.md`**, mục "Việc BẮT BUỘC
   làm trước khi lên production", thay vì chỉ sửa lặng lẽ trong `.env.example`.

### Ngoại lệ: `.env` ở thư mục gốc

Docker Compose **chỉ** tự đọc tệp tên đúng `.env` cùng thư mục — nó không biết tới
`.env.local`, và thiếu `--env-file` thì mọi biến thành rỗng mà không báo lỗi.
Nên thư mục gốc giữ nguyên cặp `.env` / `.env.example`, chỉ dùng cho
`docker-compose.yml` lúc triển khai. Cả hai quy tắc trên vẫn áp dụng y nguyên:
`.env` không commit, `.env.example` chỉ chứa giá trị mẫu.

### Ứng dụng đọc tệp nào

| Module | Cơ chế nạp |
|---|---|
| `backend/` | `ConfigModule.forRoot({ envFilePath: ['.env.local', '.env'] })` trong `apps/api-gateway/src/app.module.ts`; mọi biến truy cập qua `ConfigService`, khai báo tại `libs/shared/config/configuration.ts` |
| `admin-web/` | Next.js nạp `.env.local` sẵn có. Biến `NEXT_PUBLIC_*` **được nhúng vào bundle gửi trình duyệt** — tuyệt đối không đặt secret vào tiền tố này |
| `zalo-miniapp/` | Vite nạp `.env.local` (ưu tiên cao hơn `.env`). Biến `VITE_*` cũng vào bundle — không đặt secret |

Biến đã có sẵn trong môi trường (Docker, CI) luôn thắng giá trị trong tệp.

## Nguyên tắc chung của dự án

- **Không hardcode**: URL, tên đơn vị, danh mục, SLA, trạng thái, màu sắc nằm ở
  `src/config/*` của từng module hoặc biến môi trường — không rải rác trong component.
- **Adapter cho mọi dịch vụ bên thứ 3** (OCR, GIS, ZNS, FCM): đổi nhà cung cấp chỉ
  sửa một tệp adapter, không đụng vào tầng nghiệp vụ.
- **Tên trường thống nhất giữa 3 module**; `admin-web/src/types/index.ts` là nguồn chuẩn.
- **Xoá mềm dùng chung một khuôn**: mọi schema có xoá mềm phải
  `extends SoftDeletable` và lọc bằng `NOT_DELETED` / `IS_DELETED` nhập từ
  `@vigov/shared` (`libs/shared/src/schemas/soft-delete.ts`) — KHÔNG khai lại cờ
  hay viết thẳng `{ isDeleted: false }` trong service. Cờ để truy vấn là
  `isDeleted`; `deletedAt` chỉ là mốc thời gian. Điều kiện lọc là `$ne: true` để
  khớp cả bản ghi cũ chưa có trường. Thêm phân hệ mới có xoá mềm thì nhớ ba việc:
  lọc ở danh sách, lọc ở mọi nơi truy vấn collection đó TRỰC TIẾP (thống kê, báo
  cáo, tìm kiếm toàn cục, workflow), và không cấp lại mã đã dùng.

Chi tiết từng nguyên tắc → `.claude/rules/critical/` và `.claude/skills/`.

## Tài liệu

`README.md` (cách chạy, xử lý sự cố) · `SECURITY.md` (rà soát bảo mật, việc bắt buộc
trước production) · `BAO-CAO-TIEN-DO.md` (tiến độ) · `deploy/` (triển khai, UAT, phát
hành store) · `plans/` (plan chi tiết từng task) · `pending-tasks.json` (trạng thái task) ·
`docs/` (bộ tài liệu bàn giao) · `.claude/README.md` (bộ não AI agent).

Sửa mã xong là phải đồng bộ tài liệu — bảng tra "sửa gì thì cập nhật gì" ở
`.claude/skills/tai-lieu-dong-bo/SKILL.md`.
