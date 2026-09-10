# Bản đồ định tuyến agent — ViGov
# Phiên bản 1.0 · 9 agent

## NGUYÊN TẮC

Định tuyến theo **ý định → lớp → module**. `kien-truc-truong` luôn là điểm vào cho việc
lớn. Kiến thức chi tiết nằm ở `skills/` (tự kích hoạt theo từ khoá) — agent không cần
nhắc lại nội dung skill.

**Với ứng dụng nhà nước, hai agent luôn được gọi ở cuối mọi việc sửa mã:**
`ra-soat-bao-mat` (nếu chạm dữ liệu / quyền / tệp) và `dong-bo-tai-lieu` (mọi lúc).

---

## BƯỚC 1 — Loại yêu cầu

| Yêu cầu | Agent |
|---|---|
| Task lớn / nhiều module / chưa rõ phạm vi | `kien-truc-truong` |
| Thêm phân hệ mới, module backend mới | `kien-truc-truong` → `api-backend` |
| Thiết kế / đổi endpoint, hợp đồng API | `api-backend` |
| Nghiệp vụ hành chính: luồng xử lý, trạng thái, SLA, thuật ngữ | `nghiep-vu-hanh-chinh` |
| Giao diện cán bộ (Web Quản trị) | `giao-dien-quan-tri` |
| Giao diện công dân (Zalo Mini App) | `giao-dien-cong-dan` |
| Rà soát bảo mật, dữ liệu cá nhân, phân quyền | `ra-soat-bao-mat` |
| Rà soát tuân thủ pháp lý, lưu trữ, quyền công dân | `ra-soat-tuan-thu` |
| Viết / sửa test, quyết định cần test gì | `kiem-thu` |
| Cập nhật tài liệu sau khi sửa mã | `dong-bo-tai-lieu` |
| Sửa lỗi, điều tra "vì sao" | → BƯỚC 2-LỖI |
| Rà soát trước phát hành | `ra-soat-tuan-thu` + `ra-soat-bao-mat` + `kiem-thu` |

## BƯỚC 2-LỖI — theo triệu chứng

| Triệu chứng | Agent |
|---|---|
| Sai số liệu, sai trạng thái, sai hạn xử lý | `nghiep-vu-hanh-chinh` |
| Lộ dữ liệu, quyền không đúng, 401/403 sai | `ra-soat-bao-mat` |
| Lệch trường giữa 4 module, ô trống trên giao diện | `api-backend` + module client tương ứng |
| Lỗi triển khai, biến môi trường rỗng, CORS, 502 | `kien-truc-truong` (kèm `skills/trien-khai-docker`) |
| Giao diện vỡ, chữ tràn, không dùng được trên máy nhỏ | `giao-dien-cong-dan` hoặc `giao-dien-quan-tri` |
| Test đỏ | `kiem-thu` |

## BƯỚC 3 — theo lớp

**BACKEND** — module, controller, service, schema, truy vấn, hàng đợi, realtime

| Điều kiện thêm | Agent + skill |
|---|---|
| chạm dữ liệu cá nhân | `api-backend` + `ra-soat-bao-mat`; `skills/che-du-lieu-ca-nhan` |
| chạm phân quyền / phiên | `api-backend` + `ra-soat-bao-mat`; `skills/phien-va-token` |
| chạm tệp / đính kèm | `api-backend` + `ra-soat-bao-mat`; `skills/an-toan-tep-upload` |
| chạm dịch vụ ngoài | `api-backend`; `skills/adapter-ben-thu-ba` |
| chạm báo cáo / thống kê | `api-backend` + `nghiep-vu-hanh-chinh`; `skills/bao-cao-va-xuat-file` |
| thay đổi schema có dữ liệu | `api-backend` + `kien-truc-truong`; `rules/critical/bao-toan-du-lieu.md` |

**GIAO DIỆN**

| Đối tượng | Agent |
|---|---|
| Cán bộ — Web Quản trị | `giao-dien-quan-tri` |
| Công dân — Zalo Mini App | `giao-dien-cong-dan` |
| Đổi trường/kiểu ảnh hưởng nhiều module | `api-backend` điều phối; `skills/dong-bo-kieu-4-module` |

---

## SAU MỌI THAY ĐỔI MÃ — bắt buộc

| Thứ tự | Agent | Bỏ qua được khi |
|---|---|---|
| 1 | `kiem-thu` — chạy kiểm chứng thật | Không bao giờ |
| 2 | `ra-soat-bao-mat` | Thay đổi không chạm dữ liệu, quyền, tệp, cấu hình |
| 3 | `dong-bo-tai-lieu` | Không bao giờ |

## KHI NÀO KHÔNG DÙNG AGENT

Việc nhỏ, một hai tệp, đã biết rõ chỗ sửa → làm trực tiếp. Gọi agent cho việc nhỏ chỉ
tốn context. Agent dùng cho: đọc nhiều tệp, rà soát diện rộng, phân tích cần kết luận
thay vì cần nội dung tệp.
