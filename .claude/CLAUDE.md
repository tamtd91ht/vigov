# ViGov · Bộ não `.claude` — v1.0

## ĐÂY LÀ ỨNG DỤNG CỦA CƠ QUAN NHÀ NƯỚC

ViGov là nền tảng **Điều hành số cấp Xã/Phường** do UBND xã/phường vận hành. Mọi dòng
mã trong dự án này chạm tới một trong ba thứ sau:

1. **Dữ liệu cá nhân của công dân** — số điện thoại, họ tên, địa chỉ, ảnh hiện trường,
   dữ liệu thẻ căn cước. Chịu ràng buộc **Nghị định 13/2023/NĐ-CP** về bảo vệ dữ liệu
   cá nhân.
2. **Hồ sơ hành chính có giá trị pháp lý** — văn bản đến/đi, đơn thư, phiếu phản ánh,
   quyết định giải ngân. Đây là tài liệu lưu trữ, **không được xoá cứng, không được
   sửa lặng lẽ**.
3. **Uy tín của một cơ quan công quyền** — hiển thị sai tên xã, con số thống kê lệch,
   một câu tiếng Việt sai chính tả đều là sự cố có người phải giải trình.

Hệ quả bắt buộc với cách làm việc:

| Nguyên tắc | Nghĩa cụ thể |
|---|---|
| **Cẩn thận trước, nhanh sau** | Không đoán nghiệp vụ. Không "tạm thế này rồi sửa sau". Không đổi hành vi nghiệp vụ khi không được yêu cầu. |
| **Nói rõ giả định** | Trước khi viết mã, nêu giả định. Nghiệp vụ hành chính có nhiều biến thể theo địa phương — chọn thầm là chọn sai. |
| **Không phá dữ liệu** | Không xoá cứng bản ghi nghiệp vụ, không `deleteMany`, không migration mất dữ liệu. Xoá mềm + ghi vết. → `rules/critical/bao-toan-du-lieu.md` |
| **Mọi thao tác ghi phải có vết** | Ai làm, làm gì, lúc nào, từ IP nào. → `rules/critical/nhat-ky-thao-tac.md` |
| **Mặc định đóng** | Endpoint mới phải có quyền. Tệp nghiệp vụ mới phải `isPrivate = true`. Trường PII mặc định che. |
| **Tiếng Việt hành chính đúng chuẩn** | Sai chính tả, sai thuật ngữ, sai cách gọi đơn vị hành chính là lỗi nghiệp vụ, không phải lỗi nhỏ. → `rules/critical/ngon-ngu-hanh-chinh.md` |
| **Kiểm chứng, đừng chỉ khai báo** | `npm run check:all` + test liên quan phải chạy thật. Báo "đã xong" khi đã chạy và thấy xanh. |

**Khi phải chọn giữa "làm cho nhanh" và "làm cho đúng" — luôn chọn đúng, rồi nói cho
người dùng biết nó tốn thêm bao nhiêu.**

---

## KIẾN TRÚC

Ba module chung một thư mục, mỗi module tự chứa, sẵn sàng tách repo:

| Module | Sản phẩm | Stack | Người dùng |
|---|---|---|---|
| `backend/` | API nền tảng (~20 module nghiệp vụ) | NestJS 11 · MongoDB (Mongoose) · RabbitMQ · JWT+RBAC · Socket.IO | — |
| `admin-web/` | Web Quản trị (11 phân hệ) | Next.js 16 App Router · TypeScript | Cán bộ, công chức xã |
| `zalo-miniapp/` | Zalo Mini App công dân | React + Vite · zmp-sdk | Công dân |

**Hai lớp người dùng, hai mức tin cậy hoàn toàn khác nhau:**

- **Cán bộ** — tài khoản do quản trị viên cấp, có RBAC theo phân hệ, mọi thao tác ghi
  vết. Tin ở mức "có thể truy trách nhiệm".
- **Công dân** — định danh chỉ bằng số điện thoại + OTP (qua Zalo hoặc app). **Không**
  được tin. Mỗi công dân chỉ thấy đúng dữ liệu của chính mình.
  → `rules/critical/cach-ly-du-lieu-cong-dan.md`

Backend là **một** API Gateway (NestJS monorepo, `apps/api-gateway`), thư viện dùng
chung ở `libs/shared` (alias `@vigov/shared`). Không phải microservice thật —
RabbitMQ chỉ dùng cho việc nền (thông báo, workflow).

---

## HÀNH VI KHI LÀM VIỆC

| Quy tắc | Nghĩa |
|---|---|
| **Đọc trước khi sửa** | Đọc file thật, đọc module lân cận. Mã dự án này có comment tiếng Việt giải thích *vì sao* — đọc nó trước khi đổi. |
| **Sửa đúng phạm vi** | Chỉ chạm phần yêu cầu cần. Không refactor kèm, không đổi format, không "dọn dẹp" mã người khác. |
| **Đơn giản trước** | Mã ít nhất giải quyết đúng vấn đề. Không abstraction cho một chỗ dùng, không cấu hình không ai yêu cầu. |
| **Tái sử dụng trước khi viết mới** | Trước khi viết hàm tiện ích, tìm xem đã có chưa. → `skills/ke-thua-truoc-khi-viet-moi` |
| **Dọn rác của chính mình** | Xoá import/biến mà thay đổi của bạn làm thành vô dụng. Mã chết có sẵn thì để nguyên. |
| **Comment giải thích VÌ SAO** | Theo đúng văn phong đang có: tiếng Việt, nêu lý do và hậu quả nếu làm sai, không mô tả lại mã. |
| **Viết ngắn, kỹ thuật, đủ ý** | Tài liệu · comment · commit · báo cáo trả lời người dùng: một ý một câu, ưu tiên bảng, dẫn `tệp:dòng` thay vì miêu tả, không ví von, không nhắc lại. Dài dòng làm người đọc bỏ qua và tốn context mọi phiên sau. → `skills/tai-lieu-dong-bo` mục "Văn phong" |
| **Kế hoạch cho việc nhiều bước** | Nêu `1. [bước] → kiểm chứng: [cách xác nhận]` trước khi bắt đầu. |

---

## GIT — CHỈ DÙNG NHÁNH `main`

Commit và push thẳng vào `main`. **Tách nhánh chỉ khi người dùng tự quyết, hoặc khi
agent đề nghị và người dùng chốt đồng ý** — ngoài hai trường hợp đó, tự tạo nhánh là sai.

"Cho cẩn thận" không phải lý do để tự tách: thấy rủi ro thì **nói ra rủi ro**, rồi làm
theo yêu cầu. Quy ước do agent tự nghĩ ra không được chặn yêu cầu tường minh của người dùng.

→ Chi tiết: `CLAUDE.md` gốc dự án, mục "Git" · `commands/git-commit`

## LUỒNG CÔNG VIỆC

- **`pending-tasks.json`** (gốc dự án) — toàn bộ task Phase 1, trạng thái
  `pending` → `in-progress` → `done`. Mỗi task trỏ tới một plan trong `plans/`.
- **`plans/<id>-<slug>.md`** — phạm vi, checklist, câu hỏi mở liên quan của từng task.
- **Câu hỏi mở** (~27 câu, khách chưa chốt) — danh sách gốc ở `ESTIMATE_TECHNICAL.md`.
  Gặp chỗ phụ thuộc câu hỏi mở: **không tự chốt** — nêu ra, làm theo mặc định an toàn
  nhất, ghi lại là giả định.
- Xong một task: cập nhật trạng thái + tài liệu liên quan → `/task-xong`.

## TÀI LIỆU — ghi vào đâu

| Nội dung | Nơi ghi |
|---|---|
| Cách chạy, xử lý sự cố | `README.md` (gốc) và `<module>/README.md` |
| Rà soát bảo mật, việc bắt buộc trước production | `SECURITY.md` |
| Tiến độ, kiến trúc tóm lược, còn thiếu gì | `BAO-CAO-TIEN-DO.md` |
| Tài liệu bàn giao theo module | `docs/01..07-*.md` |
| Triển khai, UAT, phát hành store | `deploy/` |
| Plan chi tiết từng task | `plans/` |
| Quyết định kiến trúc có tranh luận | `docs/quyet-dinh/NNNN-*.md` (ADR) — xem `skills/quyet-dinh-kien-truc` |

**Sửa mã xong là phải đồng bộ tài liệu** → `skills/tai-lieu-dong-bo`.

---

## BIẾN MÔI TRƯỜNG

Quy ước `.env.local` (giá trị thật, không commit) ↔ `.env.example` (mẫu, commit) —
**đọc đầy đủ ở `CLAUDE.md` gốc dự án**, mục "Biến môi trường". Tóm lại:

- Thêm biến mới → sửa **CẢ HAI** tệp.
- **Không bao giờ** đặt giá trị thật vào `.env.example`.
- **Không** in nội dung `.env.local` ra chat, commit message, hay tài liệu.
- Thư mục gốc là ngoại lệ: dùng cặp `.env` / `.env.example` cho `docker-compose.yml`.
- `NEXT_PUBLIC_*` và `VITE_*` **nằm trong bundle gửi trình duyệt** — không đặt secret.

→ Chi tiết + cưỡng chế: `rules/critical/bi-mat-cau-hinh.md`

---

## LUẬT (tự động nạp)

`rules/critical/` — 8 tệp, nạp sẵn mọi phiên. Đây là mức "không thương lượng":

| Tệp | Chặn điều gì |
|---|---|
| `du-lieu-ca-nhan.md` | Lộ / ghi log / truyền ra ngoài dữ liệu cá nhân công dân |
| `cach-ly-du-lieu-cong-dan.md` | Công dân A đọc được dữ liệu của công dân B |
| `phan-quyen-rbac.md` | Endpoint không quyền, leo thang quyền, token không thu hồi được |
| `nhat-ky-thao-tac.md` | Thao tác ghi không để lại vết |
| `bao-toan-du-lieu.md` | Xoá cứng, mất dữ liệu do migration, mất tài liệu lưu trữ |
| `bi-mat-cau-hinh.md` | Secret lọt vào mã / bundle / git |
| `khong-hardcode.md` | Tên xã, URL, SLA, danh mục nằm rải rác trong component |
| `ngon-ngu-hanh-chinh.md` | Tiếng Việt sai, thuật ngữ hành chính sai, giọng điệu sai với công dân |

Chỉ mục đầy đủ + tra cứu: `rules/_INDEX.md`

## KỸ NĂNG (tự kích hoạt theo từ khoá)

`skills/<tên>/SKILL.md` — nạp lười, tự bật khi từ khoá khớp. Nhóm chính:

- **Backend**: `nestjs-module-pattern` · `mongoose-schema-conventions` ·
  `api-contract-design` · `dto-validation-hardening` · `tim-kiem-mongo-an-toan` ·
  `hang-doi-rabbitmq` · `realtime-socket`
- **Bảo mật / định danh**: `an-toan-tep-upload` · `phien-va-token` ·
  `xac-thuc-otp-cong-dan` · `che-du-lieu-ca-nhan`
- **Client**: `nextjs-admin-web` · `zalo-miniapp-platform` · `tiep-can-nguoi-cao-tuoi`
- **Xuyên module**: `dong-bo-kieu-4-module` · `sla-va-trang-thai` ·
  `adapter-ben-thu-ba` · `ke-thua-truoc-khi-viet-moi`
- **Quy trình**: `kiem-thu-vigov` · `tai-lieu-dong-bo` · `quan-ly-task-plan` ·
  `quyet-dinh-kien-truc` · `trien-khai-docker` · `bao-cao-va-xuat-file` ·
  `tuan-thu-phap-ly`

## DỮ LIỆU THAM CHIẾU

| Tệp | Nạp khi |
|---|---|
| `data/glossary.md` | Gặp thuật ngữ hành chính lạ (văn bản đến, luân chuyển, một cửa…) |
| `data/constants.md` | Cần biết hạn mức, TTL, cổng, vai trò, trạng thái |
| `data/modules.json` | Cần biết module nào làm gì, thuộc phân hệ nào |
| `data/tuan-thu-phap-ly.md` | Câu hỏi về nghị định, thời hạn lưu trữ, dữ liệu cá nhân |

## QUY TRÌNH

→ `workflows/_INDEX.md` (7 quy trình theo loại việc)

## AGENT

Điều phối: `agents/kien-truc-truong.md` → định tuyến theo `agents/_ROUTING.md`
Sau mỗi lần sửa mã: `agents/dong-bo-tai-lieu.md`

## LỆNH

**Phân tích / thiết kế:** `/phan-tich-task` · `/module-moi` · `/api-moi` · `/quyet-dinh`
**Thực hiện:** `/thuc-hien` · `/dong-bo-kieu`
**Rà soát:** `/ra-soat-bao-mat` · `/ra-soat-tuan-thu` · `/ra-soat-diff` · `/kiem-tra-hardcode` · `/kiem-tra-env` · `/kiem-tra-build`
**Task:** `/task-hien-tai` · `/task-xong` · `/bao-cao-tien-do`
**Phát hành:** `/truoc-phat-hanh` · `/git-commit`

Mỗi lệnh → `commands/<tên>.md`

---

## GIỚI HẠN KÍCH THƯỚC TỆP

Phần nạp-sẵn phải gọn. Trần theo loại tệp:

| Loại | Trần dòng | Lý do |
|---|---|---|
| `rules/critical/*.md` | 120 | Nạp mọi phiên — từng dòng đều tốn context |
| `skills/**/SKILL.md` | 250 | Nạp lười — bảng + mã tối thiểu |
| `agents/*.md` | 200 | Định tuyến + vai trò, không phải chỗ viết mã |
| `commands/*.md` | 150 | Đặc tả lệnh — chi tiết thì trỏ sang skill |
| `workflows/*.md` | 200 | Danh sách bước + bảng |

Vượt trần: tách tệp, hoặc chuyển khối mã sang `skills/`, hoặc chuyển văn xuôi dài
sang `docs/`. **Không** vẽ cây quyết định ASCII, không viết lý luận nhiều đoạn,
không nhân bản nội dung — luôn tham chiếu chéo.
