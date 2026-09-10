# Bốn quyền API Zalo — chi tiết từng quyền

Tờ làm việc để ngồi trước Console điền cho xong. Mỗi quyền một mục, đủ bốn thứ:
**ID · mục đích · mô tả dán vào form · cách chụp ảnh minh hoạ**.

Khác gì `09-ZALO-XIN-QUYEN-API.md`: tệp đó là hồ sơ tổng — thiết lập chung,
webhook, điều khoản, việc còn treo. Tệp này chỉ có phần điền form cho bốn quyền,
gom theo từng quyền thay vì rải ra nhiều mục, để không phải nhảy qua lại giữa
"lý do" ở mục 3 và "ảnh" ở mục 4.

| | |
|---|---|
| Mini App | ViGov · ID `1891838922591157582` |
| Đường dẫn Console | Quản lý → Xét duyệt phiên bản → Bước 1: Yêu cầu quyền |
| Cập nhật | 07/09/2026 |

---

## 0. Ba điều phải biết trước khi mở form

**Một — phải có phiên bản đang chờ.** Console không cho xin quyền khi chưa nộp
phiên bản nào: *"chỉ được yêu cầu xét duyệt Quyền sử dụng API khi có ít nhất 1
phiên bản đang chờ hoặc đã được xét duyệt"*. Trạng thái **đang chờ** là đủ,
không phải đợi kiểm duyệt đậu. Trước đó còn phải hoàn tất *Bước 2 — Thiết lập
chung*.

**Hai — mọi mô tả phải khớp điều khoản đang phát hành.** Bản đang phát hành là
bản **demo**: điều khoản nói rõ ứng dụng không phải kênh hành chính của cơ quan
nào và phiếu phản ánh KHÔNG chuyển tới cơ quan chức năng. Nên đừng viết trong
form rằng dữ liệu "để cán bộ phân công xử lý" hay "chuyển tới cơ quan có thẩm
quyền". Người xét duyệt đọc chéo hai tài liệu thấy vênh là trượt — đúng lý do
Zalo từ chối ngày 05/09/2026. Bốn bản mô tả dưới đây đã viết theo bản demo.

**Ba — người dùng thử KHÔNG được miễn xét duyệt.** Ghi chú trên trang *Quản lý
quyền* nói ngược lại, nhưng đã kiểm chứng 31/08/2026 trên Android với tài khoản
người dùng thử: cả bốn API đều không chạy. Đừng dựa vào ghi chú đó để hoãn việc
xin quyền.

---

## 1. Quyền 25 — `scanQRCode`

| | |
|---|---|
| ID | **25** |
| Tên trên Console | Mở tính năng quét QR Code |
| Biểu hiện khi chưa cấp | `[-2000] Unknown error. Please try again later.` |

**Mục đích:** đọc mã QR ở hai chỗ — mã in trên thẻ Căn cước để điền sẵn tờ khai,
và mã trên phiếu tiếp nhận hồ sơ để tra cứu tiến độ.

### Mô tả dán vào form

> Ứng dụng dùng quyền quét QR Code ở hai chức năng:
>
> 1. **Quét mã QR in trên thẻ Căn cước** để tự động điền các trường của tờ khai
> thủ tục hành chính (số căn cước, họ tên, ngày sinh, giới tính, nơi thường trú,
> ngày cấp), thay cho việc người dùng gõ tay từng trường. Ứng dụng chỉ đọc chuỗi
> ký tự in trong mã QR và hiển thị ngay tại chỗ trên máy của người dùng để họ
> đối chiếu; không chụp ảnh thẻ, không lưu ảnh thẻ, không gửi dữ liệu thẻ về máy
> chủ.
>
> 2. **Quét mã QR trên phiếu tiếp nhận hồ sơ** để tra cứu tiến độ, thay cho việc
> gõ tay mã hồ sơ dạng `HS-2026-04182`.
>
> Máy ảnh chỉ được mở khi người dùng chủ động bấm nút quét, và đóng ngay khi đọc
> xong hoặc khi người dùng thoát.
>
> Phiên bản hiện tại là bản demo phục vụ trải nghiệm và kiểm thử tính năng; hồ sơ
> hiển thị trong ứng dụng là dữ liệu mẫu.
>
> Đường vào: Cá nhân → Quét thẻ căn cước; và Trang chủ → Tra cứu hồ sơ.

### Cách chụp ảnh minh hoạ

**Ảnh 1 — màn quét thẻ căn cước.** Cá nhân (tab thứ 4 ở thanh dưới) → mục *Tiện
ích của tôi* → dòng thứ 3 **"Quét thẻ căn cước"**. Trong ảnh phải thấy rõ nút
**"Quét mã QR trên thẻ"**.

**Ảnh 2 — màn tra cứu hồ sơ.** Trang chủ → ô **"Tra cứu hồ sơ"**. Trong ảnh phải
thấy ô nhập mã hồ sơ và nút quét QR bên cạnh.

Chụp được ngay, không cần quyền: hai nút này luôn hiển thị.

> **Bắt buộc trước khi chụp ảnh 1:** trên màn quét thẻ căn cước có nút **"Chẩn
> đoán tích hợp"** — bảng này in ra lỗi kỹ thuật của SDK. Đảm bảo bảng đang đóng.
> Nộp ảnh có thông báo lỗi là tự hạ điểm hồ sơ của mình.

---

## 2. Quyền 38 — `getLocation`

| | |
|---|---|
| ID | **38** |
| Tên trên Console | Lấy thông tin vị trí hiện tại |
| Biểu hiện khi chưa cấp | Không hiện popup xin quyền nào |

**Mục đích:** gắn một điểm toạ độ vào phiếu phản ánh, để xác định chỗ xảy ra sự
việc thay cho mô tả bằng lời.

### Mô tả dán vào form

> Ứng dụng dùng vị trí ở chức năng **Gửi phản ánh, kiến nghị**. Khi người dùng
> phản ánh một sự việc ngoài hiện trường — rác tồn đọng, đèn đường hỏng, ngập
> úng — phiếu cần một điểm toạ độ để xác định chỗ xảy ra sự việc, thay cho việc
> mô tả bằng lời.
>
> Luồng cụ thể: người dùng vào bước 2 của biểu mẫu phản ánh, ứng dụng hiện một
> hộp thoại giải thích vì sao cần vị trí và hỏi ý kiến người dùng trước. Chỉ khi
> người dùng bấm "Tiếp tục lấy vị trí", ứng dụng mới gọi
> `getLocation` để lấy token, gửi token về máy chủ và đổi lấy toạ độ ở phía máy
> chủ. Toạ độ được hiển thị ngay trên một bản đồ nhỏ để người dùng tự kiểm tra
> điểm có đúng chỗ mình đang đứng hay không trước khi gửi, và người dùng luôn sửa
> được địa chỉ bằng tay. Ứng dụng không lưu token, không theo dõi vị trí liên
> tục, không chia sẻ vị trí cho bên thứ ba.
>
> Vị trí chỉ được lấy tại đúng bước đó, và khi người dùng chủ động bấm "Định vị
> lại". Không lấy ở bất kỳ màn hình nào khác, không lấy khi ứng dụng chạy nền.
>
> Nếu người dùng từ chối, biểu mẫu vẫn dùng được bình thường: người dùng tự nhập
> địa chỉ nơi xảy ra sự việc.
>
> Phiên bản hiện tại là bản demo phục vụ trải nghiệm và kiểm thử tính năng; phiếu
> phản ánh trong ứng dụng là dữ liệu mô phỏng, không chuyển tới cơ quan nào.
>
> Đường vào: Trang chủ → Gửi phản ánh → bước 2.

### Nếu form cho nhập thêm: vì sao không thay được bằng webview

Đây là lập luận mạnh nhất của hồ sơ 38 vì nó có số đo thật:

> Mini App chạy trong webview nên `navigator.geolocation` gọi được. Nhưng khi
> webview không được cấp một điểm định vị thật, nó trả về ước lượng rất thô. Thử
> thật ngày 07/09/2026: thiết bị đang ở Tuy Hoà (Phú Yên), webview trả về một
> điểm giữa Hà Nội — lệch khoảng 1.000km, sai số do thiết bị tự khai lên tới hàng
> chục nghìn mét. Toạ độ như vậy vô dụng với chức năng phản ánh hiện trường, nên
> ứng dụng đã phải chủ động loại bỏ nó và bắt người dùng nhập địa chỉ tay.
> `getLocation` lấy vị trí bằng quyền của chính ứng dụng Zalo ở tầng hệ điều
> hành, không qua webview, nên là đường duy nhất cho ra toạ độ dùng được.

Chỉ dẫn **con số đo được**. Cách giải thích *tại sao* lại ra Hà Nội (dải IP di
động Việt Nam phần lớn đăng ký ở Hà Nội) là suy luận, chưa kiểm chứng độc lập —
đừng đưa vào hồ sơ.

### Cách chụp ảnh minh hoạ

Trang chủ → ô **"Gửi phản ánh"** (hoặc nút tròn hồng giữa thanh dưới) → chọn một
lĩnh vực → **Tiếp tục** để sang bước 2. Trong ảnh phải thấy rõ phần **"Vị trí xảy
ra sự việc"**.

**Đây là quyền khó chụp nhất.** Chính vì quyền chưa được cấp, bước 2 trên máy
thật hiện ra nhánh thất bại — ô nhập địa chỉ kèm dòng *"Chưa xác định được vị trí
đủ chính xác"*. Chụp đúng cái đó rồi nộp là tự tay đưa cho người xét duyệt một
ảnh báo lỗi. Hai đường ra:

- **Chụp nơi có GPS thật.** Bật *vị trí chính xác* cho ứng dụng Zalo (Cài đặt →
  Ứng dụng → Zalo → Quyền → Vị trí → Chính xác), bật định vị của máy, ra chỗ
  thoáng. Đo được điểm sai số dưới 500m thì bản đồ xem trước hiện lên và ảnh nhìn
  đúng như tính năng hoàn chỉnh.
- **Dựng ảnh từ bản chạy trên trình duyệt** — cách đã dùng cho quyền 100, xem mục
  5 bên dưới.

---

## 3. Quyền 94 — `chooseImage`

| | |
|---|---|
| ID | **94** |
| Tên trên Console | Mở cửa sổ chọn media từ thiết bị |
| Biểu hiện khi chưa cấp | Không mở trình chọn ảnh |

**Mục đích:** đính kèm tối đa 3 ảnh hiện trường vào phiếu phản ánh.

### Mô tả dán vào form

> Ứng dụng dùng quyền chọn ảnh ở chức năng **Gửi phản ánh, kiến nghị**. Người
> dùng đính kèm tối đa 3 ảnh hiện trường vào phiếu để mô tả sự việc bằng hình,
> thay cho việc chỉ tả bằng chữ — với các sự việc như rác tồn đọng, đèn đường
> hỏng hay ngập úng thì một ảnh nói rõ hơn nhiều dòng mô tả.
>
> Trình chọn ảnh chỉ mở khi người dùng chủ động bấm nút thêm ảnh. Người dùng xem
> lại và xoá được từng ảnh trước khi gửi. Ứng dụng không tự động đọc thư viện ảnh,
> không quét ảnh nào ngoài những ảnh người dùng chọn.
>
> Phiên bản hiện tại là bản demo phục vụ trải nghiệm và kiểm thử tính năng; phiếu
> phản ánh trong ứng dụng là dữ liệu mô phỏng, không chuyển tới cơ quan nào.
>
> Đường vào: Trang chủ → Gửi phản ánh → bước 2 → nút "Thêm ảnh".

### Cách chụp ảnh minh hoạ

Cùng màn với quyền 38: Trang chủ → **"Gửi phản ánh"** → chọn lĩnh vực → **Tiếp
tục**. Trong ảnh phải thấy rõ phần **"Ảnh hiện trường"** với ô **"Thêm ảnh"** và
dòng *"Tối đa 3 ảnh · đã chọn 0"*.

Chụp được ngay, không cần quyền: ô "Thêm ảnh" luôn hiển thị. Ảnh có sẵn 2-3 ảnh
đã đính kèm thì thuyết phục hơn — muốn vậy thì dùng cách ở mục 5.

---

## 4. Quyền 100 — `getPhoneNumber`

| | |
|---|---|
| ID | **100** |
| Tên trên Console | Xin người dùng cấp quyền truy cập số điện thoại |
| Biểu hiện khi chưa cấp | Không hiện popup xin quyền nào |

**Mục đích:** định danh người dùng ở màn hình đầu tiên, để họ xem lại được những
phiếu chính mình đã gửi.

### Mô tả dán vào form

> Ứng dụng dùng số điện thoại để **định danh người dùng** ngay ở màn hình đầu
> tiên. Số điện thoại là khoá định danh duy nhất giữa Mini App và hệ thống xử lý
> hồ sơ, phản ánh: nó gắn người dùng với các phiếu phản ánh đã gửi và hồ sơ đã
> nộp, để họ tra cứu lại tiến độ của chính mình và nhận thông báo khi trạng thái
> thay đổi.
>
> Luồng cụ thể: người dùng bấm "Liên kết số điện thoại Zalo" ở màn định danh (ảnh
> 1). Ứng dụng gọi `getPhoneNumber` để lấy token, gửi token về máy chủ và đổi lấy
> số điện thoại ở phía máy chủ. Ứng dụng không lưu token, không chia sẻ số điện
> thoại cho bên thứ ba, và xoá dữ liệu khi người dùng yêu cầu.
>
> Nếu người dùng từ chối hoặc không lấy được số từ Zalo, ứng dụng chuyển sang
> đường thay thế: người dùng tự nhập số điện thoại rồi nhận mã xác thực để hoàn
> tất định danh (ảnh 2). Được cấp quyền truy cập số điện thoại thì bỏ được cả
> bước nhập tay lẫn bước chờ mã xác thực này.
>
> Không có số điện thoại, người dùng chỉ xem được nội dung công khai, không dùng
> được dịch vụ nào cần định danh.
>
> Phiên bản hiện tại là bản demo phục vụ trải nghiệm và kiểm thử tính năng; dữ
> liệu nghiệp vụ trong ứng dụng là dữ liệu mẫu, còn số điện thoại chỉ dùng để tạo
> phiên trải nghiệm cho chính người dùng đó.
>
> Đường vào: màn hình đầu tiên khi mở ứng dụng, nút "Liên kết số điện thoại Zalo".

> **Đừng đặt lý do là "để gửi tin OTP".** Hai chuyện ngược nhau: `getPhoneNumber`
> tồn tại để **khỏi phải** gửi OTP. Xin quyền lấy số điện thoại nhằm gửi OTP tới
> chính số đó là lý lẽ tự mâu thuẫn. Thêm nữa, `AuthService.requestOtp` ở backend
> hiện chỉ ghi mã ra log, chưa gửi SMS/ZNS thật — người xét duyệt thử luồng đó thì
> không nhận được tin nhắn nào. Giữ lý do ở việc định danh, đường OTP chỉ nêu như
> phương án dự phòng, đúng như mã nguồn đang làm.

### Cách chụp ảnh minh hoạ

**Đã có sẵn hai ảnh**, không phải chụp lại:

| Tệp | Nội dung |
|---|---|
| `anh-xin-quyen/quyen-100-so-dien-thoai-man-dinh-danh.png` | Màn định danh, thấy rõ nút *Liên kết số điện thoại Zalo* |
| `anh-xin-quyen/quyen-100-duong-otp-thay-the.png` | Đường thay thế khi không lấy được số từ Zalo |

Muốn chụp lại trên máy thật: gỡ Mini App khỏi danh sách đã dùng (hoặc xoá dữ liệu
định danh) rồi mở lại — màn định danh là màn đầu tiên khi chưa liên kết số.

---

## 5. Dựng ảnh minh hoạ từ bản chạy trên trình duyệt

Dùng khi màn hình cần chụp lại phụ thuộc đúng cái quyền chưa được cấp — tình
huống của quyền 38, và của quyền 94 nếu muốn ảnh có ảnh đính kèm sẵn.

Đây là ảnh **minh hoạ tính năng**, không phải bằng chứng nghiệp vụ, nên cách này
chấp nhận được. Hai ảnh của quyền 100 đã dựng theo đúng cách này.

1. Trong `zalo-miniapp/.env.local`, đặt tạm `VITE_USE_MOCK_SDK=true`. Cờ này làm
   `zaloService` trả dữ liệu mẫu thay vì gọi zmp-sdk: `getLocation` trả toạ độ
   mẫu (bước 2 hiện đủ bản đồ và địa chỉ), `chooseImage` trả ảnh mẫu.
2. `npm run dev` trong `zalo-miniapp/`.
3. Mở trong Chrome, bật DevTools → chế độ thiết bị, đặt khung **390×812** (tỉ lệ
   điện thoại). Hai ảnh quyền 100 dựng ở khung này, ra 604×1305 và 615×1313 điểm ảnh.
4. Đi tới màn cần chụp, chụp ảnh màn hình, lưu vào `docs/anh-xin-quyen/` với tên
   dạng `quyen-<id>-<noi-dung>.png`.
5. **Trả `VITE_USE_MOCK_SDK` về `false`.** Quên bước này là bản build kế tiếp
   chạy toàn dữ liệu mẫu — camera, vị trí, chọn ảnh đều giả, mà không có gì báo.

Ràng buộc khi chụp:

- Không để lộ nhãn nào cho thấy đang chạy dữ liệu mẫu.
- Không để lộ bảng "Chẩn đoán tích hợp" hay bất kỳ thông báo lỗi nào.
- Định dạng JPG/PNG/JPEG, mỗi tệp tối đa 5MB.
- Ảnh chụp trên máy thật vẫn thuyết phục hơn — có thanh trạng thái, giờ, cột
  sóng. Dùng cách này khi máy thật không dựng được màn hình cần chụp.

---

## 6. Bảng đối chiếu nhanh

| ID | API | Màn hình chụp | Chụp được ngay? |
|---|---|---|---|
| 25 | `scanQRCode` | Quét thẻ căn cước · Tra cứu hồ sơ | Được — nhớ đóng bảng chẩn đoán |
| 38 | `getLocation` | Gửi phản ánh, bước 2 — phần "Vị trí xảy ra sự việc" | **Không** — cần GPS thật hoặc mục 5 |
| 94 | `chooseImage` | Gửi phản ánh, bước 2 — phần "Ảnh hiện trường" | Được — đẹp hơn nếu dùng mục 5 |
| 100 | `getPhoneNumber` | Màn định danh đầu tiên | Đã có ảnh sẵn |
