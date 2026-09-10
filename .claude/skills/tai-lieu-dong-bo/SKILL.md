---
name: tai-lieu-dong-bo
description: Dùng sau khi sửa mã, để cập nhật tài liệu bị ảnh hưởng. Kích hoạt bởi: cập nhật tài liệu, đồng bộ tài liệu, README, SECURITY.md, BAO-CAO-TIEN-DO, docs/, tài liệu bàn giao, doc sync, ghi lại thay đổi, changelog.
---

# Kỹ năng: Đồng bộ tài liệu sau khi sửa mã
# Mức: CAO | Ngăn: tài liệu bàn giao nói khác hiện trạng mã nguồn

## Vì sao khắt khe với dự án này

ViGov là dự án **có bàn giao**. Khách hàng là cơ quan nhà nước, và bộ tài liệu (`docs/`,
`deploy/`, `SECURITY.md`) là sản phẩm giao nộp, không phải ghi chú nội bộ. Tài liệu nói
khác mã là lỗi bàn giao — người vận hành làm theo tài liệu và gặp hệ thống khác.

## Bảng tra: sửa gì thì cập nhật gì

| Thay đổi | Tài liệu phải cập nhật |
|---|---|
| Thêm/đổi endpoint | `docs/01-BACKEND.md` (bảng endpoint) · `backend/README.md` nếu đổi cách chạy |
| Thêm/đổi biến môi trường | `.env.example` của module **+** `.env.example` gốc nếu truyền qua Docker **+** `docs/04-TRIEN-KHAI-VPS.md` nếu phải đặt lúc triển khai |
| Sửa hoặc thêm chốt bảo mật | `SECURITY.md` mục 1 (checklist) và mục 2 (danh sách phát hiện) |
| Đổi giá trị mặc định nhạy cảm | `SECURITY.md` mục 4 "Việc BẮT BUỘC làm trước khi lên production" |
| Thêm màn / đổi luồng Web Quản trị | `docs/02-ADMIN-WEB.md` |
| Thêm màn / đổi luồng Mini App | `docs/03-ZALO-MINIAPP.md` |
| Đổi phần liên quan tới quyền API Zalo | `docs/09-ZALO-XIN-QUYEN-API.md` · `docs/10-*` · `docs/11-*` |
| Đổi cách triển khai, nginx, Docker | `docs/04-TRIEN-KHAI-VPS.md` · `docs/06-VAN-HANH.md` · `deploy/nginx-vigov.conf` |
| Đổi manifest k8s hoặc `Jenkinsfile` | `docs/05-TRIEN-KHAI-K8S.md` · `k8s/README.md` |
| Đổi cách build app | `docs/08-ZALO-PHAT-HANH.md` |
| Đổi cách chạy dev, gặp sự cố mới | `README.md` (bảng xử lý sự cố) |
| Xong một task | `pending-tasks.json` (trạng thái) · `BAO-CAO-TIEN-DO.md` |
| Quyết định kiến trúc có tranh luận | `docs/quyet-dinh/NNNN-*.md` → `skills/quyet-dinh-kien-truc` |
| Thêm khái niệm nghiệp vụ mới | `.claude/data/glossary.md` |
| Thêm luật / kỹ năng vào bộ não | `.claude/rules/_INDEX.md` · `.claude/CLAUDE.md` |

## MUST

| # | Luật |
|---|------|
| 1 | Sửa mã xong → liệt kê tài liệu bị ảnh hưởng theo bảng trên, rồi cập nhật từng tệp |
| 2 | Cập nhật tài liệu **trong cùng commit** với thay đổi mã |
| 3 | Tài liệu viết tiếng Việt, đúng chính tả, đúng thuật ngữ → `rules/critical/ngon-ngu-hanh-chinh.md` |
| 4 | Sửa một chốt bảo mật thì đổi **trạng thái** của phát hiện tương ứng trong `SECURITY.md`, không chỉ thêm dòng mới |
| 5 | Ghi rõ **rủi ro còn tồn** thay vì bỏ trắng — "⚠️ Còn tồn đọng" kèm lý do là thông tin có giá trị |
| 6 | Nói rõ trong báo cáo cuối cùng: đã cập nhật những tệp tài liệu nào |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Ghi giá trị thật của biến môi trường vào tài liệu (tên biến thì được) |
| 2 | Ghi dữ liệu cá nhân thật vào tài liệu, kể cả làm ví dụ |
| 3 | Đánh dấu một hạng mục `SECURITY.md` là "✅ Đã làm" khi chưa kiểm chứng thật |
| 4 | Xoá một phát hiện khỏi `SECURITY.md` — đổi trạng thái, giữ lịch sử |
| 5 | Viết tài liệu mô tả điều mã **sẽ** làm — tài liệu mô tả điều mã **đang** làm |
| 6 | Tạo tệp tài liệu mới khi đã có tệp đúng chủ đề (bộ tài liệu phồng lên là khó bàn giao) |

## MỘT CHỦ ĐỀ — MỘT TÀI LIỆU (chống sinh tài liệu rác)

Luật quan trọng nhất của mục này. Bộ tài liệu là **sản phẩm bàn giao cho cơ quan nhà
nước**; nó phồng lên vì mỗi lần sửa lại thêm một tệp là nó mất giá trị bàn giao —
người vận hành không biết tệp nào còn đúng, và làm theo tệp cũ.

### Luật

| # | Luật |
|---|------|
| 1 | Mỗi chủ đề có **đúng một** tệp phụ trách. Trước khi tạo tệp mới, tra `docs/README.md` — chắc chắn không tệp nào đang phụ trách chủ đề đó |
| 2 | Tính năng làm dở → **hoàn thiện tệp đã có** của nó. KHÔNG tạo `X-phan-2.md`, `X-bo-sung.md`, `X-v2.md`, `X-moi.md` |
| 3 | Nội dung cùng chủ đề nằm ở hai nơi → **gộp về một**, nơi kia trỏ sang. Không nhân bản nội dung |
| 4 | Tạo tệp mới → thêm vào chỉ mục `docs/README.md` **ngay trong cùng commit** |
| 5 | Tài liệu chỉ nằm ở `docs/`. `deploy/` chỉ chứa tệp chạy được, `k8s/` chỉ chứa manifest (kèm một `README.md` ngắn trỏ về `docs/`) |
| 6 | Nội dung đã chuyển đi nơi khác → **xoá tệp cũ**, không để lại bản trùng "cho chắc" |
| 7 | Tài liệu mô tả điều mã **đang** làm. Phần chưa kiểm chứng phải gắn nhãn rõ (ví dụ "THIẾT KẾ ĐỀ XUẤT — chưa kiểm chứng") |

### Dấu hiệu đang sinh rác — dừng lại và gộp

- Sắp đặt tên tệp có `-phan-2`, `-bo-sung`, `-moi`, `-v2`, `-final`, `-update`
- Sắp chép một bảng/đoạn đã có ở tệp khác sang tệp đang viết
- Hai tệp cùng trả lời một câu hỏi của người đọc ("triển khai thế nào?")
- Viết xong không biết thêm dòng nào vào `docs/README.md`

### Cách gộp cho đúng

1. Chọn **một** tệp làm nơi giữ chủ đề (thường là tệp đầy đủ nhất).
2. Chuyển phần độc nhất của các tệp kia sang — đọc kỹ, **không bỏ sót nội dung**.
3. `git rm` tệp đã rỗng nội dung.
4. Sửa **mọi** tham chiếu trỏ tới tệp cũ (`grep -rn "<tên-tệp-cũ>" --include=*.md .`).
5. Cập nhật `docs/README.md`.

## Định dạng bộ tài liệu `docs/`

Đánh số theo thứ tự đọc: `01-BACKEND` → `02-ADMIN-WEB` → `03-ZALO-MINIAPP` →
`04-TRIEN-KHAI-VPS` → `05-TRIEN-KHAI-K8S` → `06-VAN-HANH` → `07-UAT-VA-NGHIEM-THU` →
`08..11-ZALO-*`. Chỉ mục ở `docs/README.md`.

Đổi tên/đánh số lại một tệp: phải sửa hết tham chiếu chéo trong **cả** `docs/`,
`.claude/`, `plans/` và các `README.md`.

→ `skills/quan-ly-task-plan` · `skills/quyet-dinh-kien-truc` · `commands/task-xong`
