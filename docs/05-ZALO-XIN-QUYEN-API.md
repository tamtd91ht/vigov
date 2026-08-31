# ViGov — Hồ sơ xin quyền API Zalo Mini App

Tài liệu chuẩn bị cho việc nộp phiên bản lên kiểm duyệt và xin 4 quyền API mà
Mini App ViGov cần. Nội dung ở đây để **dán trực tiếp** vào Console Zalo.

| | |
|---|---|
| Mini App | ViGov · ID `1891838922591157582` |
| ZaloApp | ID `3017959425515685953` |
| OA xác thực chủ sở hữu | VIHAT Software · ID `819018972942178716` |
| Loại hình sở hữu | Cơ quan nhà nước/Đơn vị sự nghiệp |
| Đường dẫn Console | Quản lý → Xét duyệt phiên bản |

---

## 1. Vì sao cần tài liệu này

Bốn API dưới đây **không hoạt động** trên bản đã deploy, kể cả với tài khoản nằm
trong danh sách người dùng thử:

| ID | API | Màn hình dùng | Biểu hiện khi chưa được cấp |
|---|---|---|---|
| 25 | `scanQRCode` | Quét thẻ căn cước · Tra cứu hồ sơ | `[-2000] Unknown error` |
| 38 | `getLocation` | Gửi phản ánh, bước 2 | Không hiện popup xin quyền |
| 94 | `chooseImage` | Gửi phản ánh, bước 2 | Không mở trình chọn ảnh |
| 100 | `getPhoneNumber` | Onboarding | Không hiện popup xin quyền |

Ghi chú trên trang *Quản lý quyền* nói người dùng thử được gọi toàn bộ API mà
không cần đợi xét duyệt. **Thực tế không đúng** — đã kiểm chứng ngày 31/08/2026
trên thiết bị Android, tài khoản người dùng thử, quyền camera đã được cấp ở cả
mức hệ điều hành lẫn mức Zalo. Đừng dựa vào ghi chú đó để bỏ qua bước xin quyền.

Mã `-2000` không phải lỗi có nghĩa: tra mã nguồn `zmp-sdk` 2.53.0 thì đó là giá
trị dự phòng khi tầng native trả lỗi rỗng cả `code` lẫn `message`.

## 2. Thứ tự bắt buộc

Console không cho đi tắt:

1. Hoàn tất **Bước 2 — Thiết lập chung** (xem mục 5). Thiếu một mục là không
   sang được bước sau.
2. Ở **Bước 1 — Yêu cầu quyền**, gửi từng hồ sơ xin quyền. Mỗi hồ sơ cần lý do
   bằng văn bản (mục 3) và ảnh minh hoạ (mục 4), cả hai bắt buộc.
3. Nộp phiên bản. Chỉ cần phiên bản ở trạng thái **đang chờ** là hồ sơ xin quyền
   đã mở được — không phải đợi kiểm duyệt đậu.

---

## 3. Lý do xin quyền — dán vào ô "Mô tả lý do yêu cầu"

### Quyền 25 — Mở tính năng quét QR Code

> ViGov là ứng dụng điều hành số của UBND xã, phục vụ công dân trên địa bàn. Quyền
> quét QR Code được dùng ở hai chức năng:
>
> 1. **Quét mã QR trên thẻ Căn cước công dân** để tự động điền thông tin công dân
> khi làm thủ tục hành chính, thay cho việc gõ tay 7 trường (số căn cước, họ tên,
> ngày sinh, giới tính, nơi thường trú, ngày cấp). Mục đích là giảm sai sót nhập
> liệu tại bộ phận một cửa. Ứng dụng chỉ đọc chuỗi ký tự in trong mã QR, hiển thị
> để công dân đối chiếu và tự xác nhận trước khi lưu; không lưu ảnh thẻ.
>
> 2. **Quét mã QR trên phiếu tiếp nhận hồ sơ một cửa** để tra cứu tiến độ xử lý
> hồ sơ, thay cho việc gõ mã hồ sơ dạng `HS-2026-04182`.
>
> Đường vào: Cá nhân → Quét thẻ căn cước; và Trang chủ → Tra cứu hồ sơ.

### Quyền 38 — Lấy thông tin vị trí hiện tại

> Dùng ở chức năng **Gửi phản ánh, kiến nghị** của công dân. Khi công dân phản ánh
> một sự việc trên địa bàn — rác tồn đọng, đèn đường hỏng, ngập úng, vi phạm trật
> tự — cán bộ xử lý cần biết vị trí chính xác để phân công đúng bộ phận và đúng
> thôn. Vị trí được lấy một lần tại bước 2 của biểu mẫu phản ánh, có popup xác
> nhận của Zalo, và công dân luôn sửa hoặc nhập tay được địa chỉ trước khi gửi.
> Từ chối cấp quyền thì biểu mẫu vẫn dùng được bình thường bằng cách nhập địa chỉ
> thủ công.
>
> Đường vào: Trang chủ → Gửi phản ánh → bước 2.

### Quyền 94 — Mở cửa sổ chọn media từ thiết bị

> Dùng ở chức năng **Gửi phản ánh, kiến nghị**. Công dân đính kèm tối đa 3 ảnh
> hiện trường để cán bộ đánh giá mức độ và xác minh nội dung phản ánh trước khi
> phân công xử lý. Ảnh chỉ được chọn khi công dân chủ động bấm nút thêm ảnh, và
> xem lại được trước khi gửi. Đây là chức năng cốt lõi của phân hệ phản ánh —
> không có ảnh hiện trường thì cán bộ phải xuống địa bàn xác minh từng phiếu.
>
> Đường vào: Trang chủ → Gửi phản ánh → bước 2 → nút thêm ảnh.

### Quyền 100 — Xin người dùng cấp quyền truy cập số điện thoại

> Dùng để **định danh công dân** khi truy cập ứng dụng lần đầu. Số điện thoại là
> khoá định danh duy nhất giữa Mini App và hệ thống một cửa của UBND xã: nó liên
> kết công dân với hồ sơ hành chính đã nộp và với các phản ánh đã gửi, để công
> dân tra cứu lại được tiến độ của chính mình và nhận thông báo khi hồ sơ chuyển
> trạng thái.
>
> Không có số điện thoại thì công dân chỉ xem được tin tức công khai, không dùng
> được dịch vụ nào cần định danh. Ứng dụng nhận token từ Zalo và đổi lấy số điện
> thoại ở phía máy chủ; không lưu token, không chia sẻ số điện thoại cho bên thứ
> ba. Công dân từ chối thì vẫn định danh được bằng luồng OTP thay thế.
>
> Đường vào: màn hình đầu tiên khi mở ứng dụng.

---

## 4. Ảnh minh hoạ — cần chụp trên máy thật

Mỗi hồ sơ phải kèm ảnh chụp **màn hình chứa chức năng dùng quyền đó**. Không cần
chức năng chạy được mới chụp được — chỉ cần màn hình hiển thị đúng.

| Quyền | Màn hình cần chụp | Đường đi |
|---|---|---|
| 25 | Màn "Quét thẻ căn cước", thấy rõ nút *Quét mã QR trên thẻ* | Cá nhân → Tiện ích của tôi → dòng thứ 3 |
| 38 | Bước 2 của Gửi phản ánh, thấy phần địa chỉ/vị trí | Trang chủ → Gửi phản ánh → bước 2 |
| 94 | Bước 2 của Gửi phản ánh, thấy nút thêm ảnh | cùng màn trên |
| 100 | Màn onboarding, thấy nút *Liên kết số điện thoại Zalo* | mở ứng dụng khi chưa định danh |

**Chụp bản sạch**: tắt bảng "Chẩn đoán tích hợp" trước khi chụp màn quét thẻ căn
cước. Ảnh có thông báo lỗi hiện lên sẽ khiến người xét duyệt đánh giá thấp.

Định dạng: JPG/PNG/JPEG, mỗi tệp tối đa 5MB.

---

## 5. Bước 2 — Thiết lập chung

| Điều kiện | Trạng thái 31/08/2026 | Ai làm |
|---|---|---|
| Xác thực eKYC tài khoản Zalo | ✅ đã xong | — |
| Xác thực Mini App | ✅ đã xong (qua OA VIHAT Software) | — |
| Xác thực Email | ❌ chưa | Chủ sở hữu — Zalo gửi link vào hộp thư |
| Thiết lập Webhook URL | ❌ chưa khai | Đã có endpoint, chờ tên miền |
| Điều khoản sử dụng | ❌ chưa | Xem mục 6, khách duyệt trước khi công bố |

### Webhook URL

Endpoint đã được cài đặt ở backend:

```
POST https://<tên-miền>/api/v1/webhooks/zalo
```

Mã nguồn: `backend/apps/api-gateway/src/modules/zalo-webhook/`.

Xử lý sự kiện công dân **rút lại sự đồng ý và yêu cầu xoá dữ liệu**. Cơ chế:

- Kiểm chữ ký bằng `ZALO_APP_SECRET`, **fail closed** — thiếu khoá hoặc thiếu chữ
  ký thì trả 403 và không xử lý gì. Đây là endpoint công khai có khả năng xoá dữ
  liệu công dân nên không có ngoại lệ nào cho việc "chưa cấu hình".
- **Vô danh hoá**, không xoá hẳn bản ghi: bỏ họ tên, khu vực, mã Zalo, token thông
  báo; khoá tài khoản; ghi `erasedAt`. Giữ lại vỏ bản ghi để không phá tham chiếu
  từ hồ sơ một cửa và phản ánh đã gửi — những thứ xã có nghĩa vụ lưu trữ.
- Thu hồi toàn bộ phiên đăng nhập, nếu không JWT còn hiệu lực vẫn dùng được app.
- Ghi nhật ký thao tác, **số điện thoại được che**, chỉ giữ 3 số cuối.

> ⚠ Hợp đồng webhook (tên sự kiện, tên trường chứa mã người dùng, cách tính chữ
> ký) **chưa được xác minh bằng tài liệu chính thức của Zalo**. Bộ xử lý nhận
> diện theo nhiều tên thay vì một tên, và ghi nhật ký mọi sự kiện lạ. Khi nhận
> được yêu cầu thật đầu tiên, đọc `Lịch sử hoạt động` để chốt hợp đồng rồi thu hẹp
> danh sách lại.

**Chặn**: cần tên miền HTTPS công khai. `192.168.3.135` hiện tại không dùng được —
Zalo phải gọi được từ Internet.

---

## 6. Điều khoản sử dụng — bản nháp

Console yêu cầu điều khoản mô tả **đầy đủ** các quyền và dữ liệu cá nhân Mini App
sử dụng. Bản dưới đây bám đúng 4 quyền đã xin ở mục 3.

> **KHÁCH HÀNG PHẢI DUYỆT TRƯỚC KHI CÔNG BỐ.** Đây là văn bản pháp lý đứng tên
> UBND xã, không phải nội dung kỹ thuật. Cần bổ sung tên đơn vị đầy đủ, địa chỉ,
> và đầu mối liên hệ về dữ liệu cá nhân trước khi đăng.

### Điều khoản sử dụng ứng dụng ViGov

**1. Phạm vi**

Ứng dụng ViGov do UBND xã Đại Thắng, huyện Phú Xuyên, thành phố Hà Nội cung cấp,
phục vụ công dân trên địa bàn tra cứu thông tin và sử dụng dịch vụ hành chính
công. Bằng việc sử dụng ứng dụng, người dùng đồng ý với các điều khoản dưới đây.

**2. Dữ liệu cá nhân được thu thập**

| Dữ liệu | Mục đích | Cơ sở |
|---|---|---|
| Số điện thoại Zalo | Định danh công dân, liên kết với hồ sơ hành chính và phản ánh đã gửi, gửi thông báo khi hồ sơ chuyển trạng thái | Sự đồng ý của người dùng |
| Tên hiển thị, ảnh đại diện Zalo | Hiển thị trong ứng dụng và trên phiếu phản ánh gửi tới cán bộ xử lý | Sự đồng ý của người dùng |
| Vị trí hiện tại | Xác định địa điểm sự việc được phản ánh, để phân công đúng bộ phận và đúng thôn | Sự đồng ý của người dùng, cho từng lần sử dụng |
| Ảnh do người dùng đính kèm | Chứng cứ hiện trường cho phản ánh, kiến nghị | Sự đồng ý của người dùng |
| Thông tin đọc từ mã QR trên thẻ Căn cước | Điền sẵn thông tin khi làm thủ tục hành chính, giảm sai sót nhập liệu | Sự đồng ý của người dùng, do chính người dùng chủ động quét |

Ứng dụng **không** lưu ảnh thẻ Căn cước, **không** lưu token do Zalo cấp, và
**không** chuyển dữ liệu cá nhân cho bên thứ ba ngoài mục đích giải quyết thủ tục
hành chính theo quy định pháp luật.

**3. Quyền truy cập thiết bị**

Ứng dụng yêu cầu các quyền sau, mỗi quyền chỉ dùng đúng mục đích đã nêu và chỉ
được gọi khi người dùng chủ động thao tác:

- **Camera / quét mã QR** — quét mã QR trên thẻ Căn cước và trên phiếu tiếp nhận
  hồ sơ.
- **Vị trí** — xác định địa điểm sự việc khi gửi phản ánh.
- **Thư viện ảnh / camera** — đính kèm ảnh hiện trường vào phản ánh.
- **Số điện thoại** — định danh công dân.

Người dùng từ chối bất kỳ quyền nào vẫn tiếp tục sử dụng được ứng dụng; chỉ chức
năng tương ứng bị hạn chế. Riêng việc từ chối cung cấp số điện thoại thì chỉ xem
được thông tin công khai.

**4. Thời gian lưu trữ**

Dữ liệu cá nhân được lưu trong thời gian người dùng còn sử dụng ứng dụng và trong
thời hạn lưu trữ hồ sơ hành chính theo quy định pháp luật về lưu trữ.

**5. Quyền của chủ thể dữ liệu**

Theo Nghị định 13/2023/NĐ-CP, người dùng có quyền được biết, xem, sửa, rút lại sự
đồng ý, yêu cầu xoá, hạn chế và phản đối việc xử lý dữ liệu cá nhân của mình.

Khi người dùng rút lại sự đồng ý qua Zalo, hệ thống tự động **bỏ toàn bộ thông
tin nhận dạng cá nhân** khỏi bản ghi công dân và thu hồi mọi phiên đăng nhập. Hồ
sơ hành chính và phản ánh đã gửi được giữ lại ở dạng không còn gắn với danh tính
người dùng, theo nghĩa vụ lưu trữ của cơ quan nhà nước.

**6. Liên hệ**

Mọi yêu cầu liên quan đến dữ liệu cá nhân, đề nghị liên hệ UBND xã Đại Thắng
theo số điện thoại một cửa `024 3378 2200`.

_(Cần bổ sung: địa chỉ trụ sở, email đầu mối về dữ liệu cá nhân, ngày hiệu lực.)_

---

## 7. Việc còn treo

| Việc | Chặn bởi |
|---|---|
| Khai Webhook URL | Tên miền HTTPS công khai |
| `VITE_API_BASE_URL` trỏ backend thật | Cùng tên miền trên |
| Xác thực email trong Console | Chủ sở hữu tự làm |
| Khách duyệt Điều khoản sử dụng | Khách hàng |
| 3 ảnh chụp cho hồ sơ xin quyền | Chụp trên máy thật |
| OA riêng của xã | Khách chưa đăng ký. OA VIHAT Software đã đủ để xác thực Mini App, nhưng nút nhắn tin cán bộ trong Danh bạ cần OA của xã mới đúng nghiệp vụ |
