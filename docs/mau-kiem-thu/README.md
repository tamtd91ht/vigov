# Tệp mẫu kiểm thử tính năng scan văn bản (OCR)

Ba tệp PDF dùng để kiểm thử luồng **Văn bản đến → tải bản scan → OCR trích trường**.

> ## ⚠ DỮ LIỆU BỊA — KHÔNG CÓ GIÁ TRỊ PHÁP LÝ
>
> Ba tệp này **mô phỏng hình thức** công văn của cơ quan nhà nước nhưng mọi thông tin
> đều là bịa: tên huyện, tên sở, số ký hiệu, tên người ký đều không tồn tại. Mỗi trang
> đóng dấu chìm và có dải cảnh báo đỏ ở chân trang.
>
> **Không in ra để lẫn vào hồ sơ thật. Không dùng làm bằng chứng.** Nếu cần tệp mẫu cho
> mục đích khác, hãy tạo mới thay vì dùng lại ba tệp này.

---

## Ba tệp và mục đích từng tệp

| Tệp | Mô phỏng | Dùng để kiểm |
|---|---|---|
| `vigov-mau-scan-01-cong-van-du-truong.pdf` | Công văn đầy đủ, chữ rõ | Ca thuận lợi — OCR đọc ra **cả 7 trường** |
| `vigov-mau-scan-02-thieu-truong.pdf` | Văn bản không ghi hạn, không ghi độ mật/khẩn | Ca **trường rỗng** — giao diện không được hiện giá trị bịa |
| `vigov-mau-scan-03-scan-chat-luong-kem.pdf` | Bản photocopy lệch, chữ nhạt, có vệt bẩn | Ca **chữ khó đọc** — độ tin cậy thấp, có trường sai |

## Kết quả mong đợi

Bảng dưới đây là kết quả đã **kiểm chứng thật** bằng chính hàm
`parseAdministrativeDocument` của backend (provider `ocrspace`).

### Tệp 01 — công văn đủ trường

| Trường | Giá trị mong đợi |
|---|---|
| Số ký hiệu | `1245/UBND-VP` |
| Ngày ban hành | `12/03/2026` |
| Cơ quan ban hành | `UBND HUYỆN ĐÔNG PHÚ VĂN PHÒNG HĐND VÀ UBND` |
| Trích yếu | `triển khai kế hoạch cải cách hành chính năm 2026 trên địa bàn xã` |
| Hạn xử lý | `20/03/2026` |
| Độ mật | `Mật` |
| Độ khẩn | `Khẩn` |

### Tệp 02 — thiếu trường

| Trường | Giá trị mong đợi |
|---|---|
| Số ký hiệu | `356/STNMT-VP` |
| Ngày ban hành | `28/02/2026` |
| Cơ quan ban hành | `SỞ TÀI NGUYÊN VÀ MÔI TRƯỜNG VĂN PHÒNG SỞ` |
| Trích yếu | `hướng dẫn cập nhật dữ liệu địa chính lên hệ thống dùng chung` |
| **Hạn xử lý** | **rỗng** — độ tin cậy 0 |
| **Độ mật** | **rỗng** — độ tin cậy 0 |
| **Độ khẩn** | **rỗng** — độ tin cậy 0 |

Đây là ca quan trọng nhất: **ba trường rỗng phải hiện rỗng**, không được điền giá trị
mặc định hay giá trị bịa, và cán bộ phải nhập tay được.

### Tệp 03 — bản scan kém

| Trường | Giá trị mong đợi |
|---|---|
| Số ký hiệu | `07/CĐ-BCĐ` |
| Ngày ban hành | `03/09/2026` |
| Cơ quan ban hành | `UBND TỈNH ĐÔNG PHÚ BAN CHỈ ĐẠO PHÒNG CHỐNG THIÊN TAI` |
| Trích yếu | `ứng phó với bão số 5 và mưa lớn diện rộng trên địa bàn tỉnh` |
| Hạn xử lý | `05/09/2026` |
| **Độ mật** | **rỗng** (văn bản không ghi độ mật) |
| Độ khẩn | `Hỏa tốc` |

## Việc cần kiểm trên giao diện

- [ ] Tải được cả ba tệp lên (đường Văn bản đến → Tiếp nhận → tải bản scan)
- [ ] Bản scan lưu ở chế độ **riêng tư** — mở bằng link trực tiếp phải bị từ chối, chỉ
      xem được qua link có chữ ký
- [ ] Bảy trường hiện đúng như bảng trên
- [ ] Trường rỗng hiện **rỗng**, không có giá trị bịa
- [ ] **Độ tin cậy hiển thị được** và trường tin cậy thấp có dấu hiệu nhắc cán bộ rà lại
- [ ] Cán bộ **sửa được** mọi trường OCR đọc sai trước khi lưu
- [ ] Lưu xong, giá trị trong hồ sơ là giá trị cán bộ đã xác nhận, không phải giá trị OCR

## Lưu ý về hai provider OCR

| Provider | Hành vi | Cấu hình |
|---|---|---|
| `mock` (mặc định) | **Không đọc nội dung tệp** — luôn trả 7 trường cố định như nhau cho mọi tệp | `OCR_PROVIDER=mock` |
| `ocrspace` | Đọc chữ thật rồi suy ra trường bằng luật chuỗi | `OCR_PROVIDER=ocrspace` + `OCR_API_KEY` |

> Chạy với `mock` thì **ba tệp cho kết quả giống nhau** — đúng thiết kế, không phải lỗi.
> Muốn thấy khác biệt giữa ba tệp thì phải chuyển nhà cung cấp sang `ocrspace`.

Đổi nhà cung cấp bằng **Cấu hình → Tích hợp** trên Web Quản trị (không cần khởi động lại
dịch vụ) hoặc bằng biến `OCR_PROVIDER`. Giao diện thắng biến môi trường.

Với `ocrspace`, sau mỗi lần bấm quét, form Tiếp nhận văn bản **hiện một ô cảnh báo màu cam**
cho biết bản scan được gửi ra dịch vụ đặt ở nước ngoài. Đây là hành vi **đúng**, cần có
trong ảnh chụp khi nghiệm thu — không phải lỗi giao diện. Nội dung cảnh báo do backend gửi
kèm kết quả (trường `notice`), nên đổi nhà cung cấp là đổi luôn câu cảnh báo mà không phải
sửa giao diện. Provider `mock` không có cảnh báo vì không gửi gì ra ngoài.

Với provider thật, độ tin cậy của mọi trường là **0.5** — cố ý để thấp, vì đó là kết quả
suy ra bằng luật chuỗi chứ không phải do nhà cung cấp khẳng định. Trường không dò được
trả rỗng với độ tin cậy 0.

## Tạo lại tệp mẫu

Ba tệp này sinh một lần bằng `pdfmake` (gói đã có trong `backend/`) rồi commit. Không có
script trong repo — cần bản mới thì tạo mới, và **kiểm chứng lại** bằng cách trích chữ
rồi chạy qua `parseAdministrativeDocument`:

```bash
pdftotext -enc UTF-8 <tệp>.pdf -    # KHÔNG dùng -layout: OCR thật trả chữ
                                    # theo thứ tự đọc, không theo cột
```

Ba điểm dễ sai khi tự làm tệp mẫu — đều đã trúng trong lúc dựng ba tệp này:

1. **Dải cảnh báo đặt ở đầu trang** → bị nhận thành "Cơ quan ban hành", vì luật dò lấy
   dòng viết hoa đầu tiên. Phải đặt ở chân trang và viết thường có dấu.
2. **Cụm "trước ngày dd/mm/yyyy" bị ngắt dòng** → mất trường Hạn xử lý. Phải để gọn
   trên một dòng.
3. **Tên cơ quan chỉ có một dòng** (không có dòng phụ) → bị gộp với quốc hiệu khi trích
   chữ, luật dò trượt xuống bắt trúng chức danh người ký ở cuối văn bản.

→ Luồng nghiệp vụ: `01-BACKEND.md` · Kịch bản nghiệm thu: `07-UAT-VA-NGHIEM-THU.md`
