---
name: an-toan-tep-upload
description: Dùng khi làm việc với tải lên, tải xuống, đính kèm, ký link tệp, ảnh hiện trường, bản scan văn bản, video/audio CMS. Kích hoạt bởi: upload, tải tệp, tải lên, file, đính kèm, attachment, signed url, link ký, isPrivate, multer, MIME, Content-Disposition, path traversal, S3, MinIO, uploads, scan, ảnh, video, audio.
---

# Kỹ năng: An toàn tệp — tải lên, lưu, phát ra
# Mức: TỐI QUAN TRỌNG | Ngăn: XSS lưu trữ, lộ bản scan văn bản, path traversal

## Bài học đã trả giá (SECURITY.md)

| Mã | Sự cố | Nay được chặn bằng |
|---|---|---|
| C-01 | Ai đăng nhập cũng xin được link đọc tệp riêng tư bất kỳ | Kiểm chủ sở hữu trong `signedUrl` |
| C-02 | Tải lên tệp HTML/SVG chứa script, phát tán link → mã chạy trên tên miền API | Chặn MIME thực thi được + buộc `attachment` |
| TB-09 | Tệp `isPrivate = false` chỉ được bảo vệ bằng độ khó đoán ObjectId | `FilesService.findPrivateById` từ chối tệp công khai ở mọi đường gắn tệp vào bản ghi nghiệp vụ |
| T-02 | Đọc tệp khỏi ổ **trước** khi kiểm chữ ký | `openForDownload` kiểm chữ ký trước |

## Hai loại tệp — phân biệt tuyệt đối

| Loại | `isPrivate` | Ví dụ | Đọc bằng |
|---|---|---|---|
| **Tệp nghiệp vụ** | **`true` — bắt buộc** | bản scan văn bản, ảnh hiện trường phản ánh, ảnh nghiệm thu, ảnh thẻ căn cước, tệp đính kèm nhiệm vụ | link ký HMAC, TTL ≤ 24 giờ |
| **Nội dung công khai** | `false` — có chủ ý | ảnh bìa tin, audio truyền thanh, video CMS | đọc trực tiếp, có cache |

Không chắc thuộc loại nào → **chọn `true`**.

## MUST

| # | Luật |
|---|------|
| 1 | Gắn tệp vào bản ghi nghiệp vụ **luôn** đi qua `FilesService.findPrivateById(id, label)` — hàm này từ chối tệp công khai (400) |
| 2 | Tải lên tệp nghiệp vụ đặt `isPrivate = true` ở **cả** client và server; server không tin cờ từ client cho các mục đích nghiệp vụ |
| 3 | Kiểm MIME **và** phần mở rộng theo danh sách cho phép của từng `purpose` |
| 4 | Tệp không nằm trong danh sách cho phép → buộc `Content-Disposition: attachment` |
| 5 | Kiểm chữ ký **trước** khi mở luồng đọc tệp (`openForDownload`) |
| 6 | So sánh chữ ký bằng `timingSafeEqual`, không bằng `===` |
| 7 | Khoá lưu trữ sinh bởi hệ thống (`randomUUID`), đối chiếu đường dẫn tuyệt đối trước khi đọc/ghi — chống path traversal |
| 8 | Tệp riêng tư trả header `Cache-Control: private, no-store` |
| 9 | Công dân chỉ ký được link cho tệp có `uploadedBy` là chính mình |
| 10 | TTL link ký mặc định ngắn; trần cứng 24 giờ. Không nới |
| 11 | Vượt `STORAGE_MAX_FILE_SIZE` bị từ chối ở **cả** Multer `limits` và service |
| 12 | Đổi nhà cung cấp kho tệp (local ↔ S3/MinIO) chỉ sửa driver trong `modules/files/drivers/` |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Cho phép MIME `text/html`, `image/svg+xml`, `application/javascript`, `text/xml`, hoặc bất kỳ MIME trình duyệt thực thi được |
| 2 | Trả `Content-Disposition: inline` cho tệp có MIME không nằm trong danh sách trắng |
| 3 | Dùng tên tệp người dùng gửi làm khoá lưu trữ hoặc ghép vào đường dẫn |
| 4 | Đặt dữ liệu cá nhân vào tên tệp (số điện thoại, CCCD, tên công dân) |
| 5 | Để nginx phục vụ tĩnh thư mục `uploads/` — mọi truy cập phải qua API để được kiểm chữ ký |
| 6 | Xoá tệp khỏi kho khi còn bản ghi nghiệp vụ tham chiếu → `rules/critical/bao-toan-du-lieu.md` |
| 7 | Ghi log đường dẫn tệp đầy đủ kèm dữ liệu cá nhân |
| 8 | Tin `file.mimetype` do client gửi mà không kiểm nội dung/phần mở rộng |

## Kiểm tra một đường gắn tệp mới

1. Có gọi `findPrivateById` chưa? (nếu không: tệp công khai lọt vào hồ sơ nghiệp vụ)
2. Công dân của người khác có ký được link tệp này không? (phải không)
3. Tải lên tệp `.svg` có script — có bị từ chối không? (phải bị)
4. Tải lên tệp `.txt` đổi tên thành `.jpg` — trả về với `attachment` chứ không `inline`?

## Việc bắt buộc trước production

Thư mục `uploads/` đặt ngoài thư mục mã nguồn, quyền `0750`, chủ sở hữu là user chạy
Node. Cân nhắc chuyển sang S3/MinIO bucket private. → `SECURITY.md` mục 4, việc 9

→ `rules/critical/du-lieu-ca-nhan.md` · `rules/critical/cach-ly-du-lieu-cong-dan.md`
