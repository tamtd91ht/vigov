# P7-04 — Script di trú dữ liệu sang khuôn v2 (một lần, 13 collection)

> Trạng thái: **pending** · Lập 11/09/2026 · Phụ thuộc: **P7-02 đã chốt schema cuối cùng**

## 1. Đây là task nguy hiểm nhất của pha P7

Di trú chạm **toàn bộ hồ sơ hành chính đang có giá trị pháp lý**. Sai một bước là mất mốc
thời gian hoặc đứt tham chiếu của tài liệu lưu trữ — thứ không tái tạo được.
`rules/critical/bao-toan-du-lieu.md` áp dụng nguyên vẹn.

Không có mã tương thích ngược (quyết định #5 của người dùng), nên **đường lùi duy nhất là
`mongorestore`**. Vì vậy bản sao lưu không phải thủ tục hình thức.

## 2. Điều kiện bắt buộc trước khi chạy trên dữ liệu thật

| # | Điều kiện |
|---|---|
| 1 | `mongodump` mới nhất, đã **thử khôi phục** vào một cơ sở dữ liệu tạm và đếm khớp số bản ghi |
| 2 | Đã chạy `--dry-run` trên **bản sao** dữ liệu thật, đọc hết báo cáo |
| 3 | Ứng dụng đã dừng nhận ghi (cửa sổ ngừng dịch vụ) |
| 4 | Người dùng xác nhận tường minh từng bước, không suy ra từ đồng ý trước đó |

## 3. Việc script phải làm

| Bước | Nội dung |
|---|---|
| 1 | **Đếm trước**: số bản ghi từng collection, số bản ghi có từng trường sắp đổi |
| 2 | **Dựng danh mục bộ phận**: mỗi tên bộ phận phân biệt trong dữ liệu → một nút `org_nodes`; in bảng tên → id để người dùng soát |
| 3 | **Đổi mốc thời gian**: `Date` → số; chuỗi `dd/MM/yyyy` → số (mốc hết ngày 23:59:59.999 giờ VN); chuỗi `HH:mm dd/MM/yyyy` của bình luận và nhật ký → số |
| 4 | **Đổi tham chiếu**: tên cán bộ → `staff_users._id`; tên bộ phận → `org_nodes._id` |
| 5 | **Tách nhật ký**: `meta` "HH:mm dd/MM/yyyy · Tên" → `{ at, actorId }`; `title` → `{ action, detail }` |
| 6 | **Dọn trường trình bày**: bỏ `authorInitials`, `authorColor` khỏi bình luận |
| 7 | **Đối soát sau**: đếm lại, và báo **từng** bản ghi không khớp được tham chiếu |

## 4. Ba tình huống không khớp — phải có luật, không được đoán

| Tình huống | Xử lý đề xuất | Cần khách chốt |
|---|---|---|
| Tên cán bộ trong bản ghi cũ không còn trong `staff_users` (đã nghỉ, đã xoá) | Giữ nguyên tên vào trường `legacyName`, `assigneeId` để rỗng | Có |
| Tên bộ phận không khớp nút nào | Tạo nút mới trong `org_nodes`, đánh dấu `migrated: true` để văn phòng soát lại | Có |
| Chuỗi thời gian sai định dạng, không phân tích được | **Không đoán.** Giữ nguyên chuỗi vào `legacyValue`, ghi vào báo cáo lỗi | Có |

Nguyên tắc chung: **không bao giờ đoán**. Không phân tích được thì giữ lại bản gốc và báo
cáo, chứ không ghi một giá trị nghe có lý.

## 5. Checklist

- [ ] `backend/scripts/migrate-v2.ts` — có `--dry-run` (mặc định) và `--apply`
- [ ] Không chạy được nếu thiếu `--apply` **và** thiếu xác nhận tương tác
- [ ] In báo cáo: đếm trước / đếm sau / danh sách không khớp / thời gian chạy
- [ ] Chạy lại được nhiều lần mà không nhân đôi dữ liệu (idempotent)
- [ ] Ghi vết vào `audit_logs` rằng đã chạy di trú: ai chạy, lúc nào, ảnh hưởng bao nhiêu bản ghi (`nhat-ky-thao-tac.md` luật 1)
- [ ] Thử trên bản sao dữ liệu thật, đối soát tay 10 bản ghi mỗi collection
- [ ] Viết mục "Di trú v2" vào `docs/06-VAN-HANH.md`, kèm cách lùi

## 6. Cách kiểm chứng

| Việc | Cách |
|---|---|
| Không mất bản ghi | Đếm từng collection trước và sau phải **bằng nhau tuyệt đối** |
| Không mất mốc thời gian | Với 10 bản ghi mẫu mỗi collection: đối chiếu ngày đọc được trên giao diện v2 với ảnh chụp giao diện v1 |
| Tham chiếu đúng người | Mọi `assigneeId` phải tra được ra đúng cán bộ cũ; danh sách rỗng phải nằm trong báo cáo không khớp |
| Chạy lại an toàn | Chạy `--apply` hai lần, kết quả lần hai không đổi gì |
