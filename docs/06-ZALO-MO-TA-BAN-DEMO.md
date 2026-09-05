# Nội dung nộp xét duyệt Zalo Mini App — bản DEMO

Dùng cho lần nộp lại sau khi hồ sơ bị từ chối (05/09/2026) với hai lý do: danh mục
"Cơ quan nhà nước – Địa phương" chưa tương thích, và app mô phỏng thông tin cơ quan
nhà nước mà không ghi rõ là demo.

Hướng xử lý: **nộp dưới dạng ứng dụng demo**, không nộp theo danh mục cơ quan nhà
nước. Bản chính thức sẽ phát hành sau trên Zalo OA của đơn vị.

Chỗ có `<...>` là phải điền trước khi dán lên Console.

---

## 1. Tên hiển thị

Zalo giới hạn số ký tự tên Mini App (kiểm tra lại trên Console trước khi dán):

| Phương án | Ký tự |
|---|---|
| `ViGov Demo` | 10 |
| `ViGov Demo – Điều hành số xã` | 28 |
| `ViGov Demo – Điều hành số cấp xã` | 32 |

Chữ "Demo" nằm ngay trong tên là cách rẻ nhất để người dùng nhận biết, và cũng
tránh trùng tên với bản chính thức sau này.

---

## 2. Mô tả ngắn

```
Ứng dụng DEMO mô phỏng kênh tương tác giữa người dân và chính quyền cấp xã, chỉ
phục vụ mục đích trải nghiệm và kiểm thử tính năng. Toàn bộ dữ liệu trong ứng dụng
là dữ liệu mẫu, không phải thông tin thật của bất kỳ cơ quan nhà nước nào.
```

---

## 3. Mô tả đầy đủ

```
⚠️ ĐÂY LÀ ỨNG DỤNG DEMO — CHỈ PHỤC VỤ TRẢI NGHIỆM VÀ KIỂM THỬ TÍNH NĂNG

ViGov Demo là bản trình diễn kỹ thuật của một Mini App điều hành số cấp xã, được
phát hành để người dùng thử và đội phát triển trải nghiệm giao diện, luồng thao tác
và các tính năng dự kiến. Ứng dụng KHÔNG phải là kênh hành chính chính thức của bất
kỳ UBND xã/phường nào và không thay thế các kênh tiếp nhận thật của cơ quan nhà nước.

NHỮNG ĐIỀU CẦN BIẾT TRƯỚC KHI DÙNG
• Toàn bộ thông tin hiển thị trong ứng dụng — tên đơn vị, cán bộ, tin tức, hồ sơ,
  số điện thoại, phiếu phản ánh — là DỮ LIỆU MẪU do đội phát triển tạo ra, không
  phản ánh thông tin thật của bất kỳ cơ quan nhà nước nào.
• Phản ánh, kiến nghị gửi trong ứng dụng KHÔNG được chuyển tới cơ quan chức năng và
  KHÔNG được xử lý. Khi cần phản ánh thật, vui lòng liên hệ trực tiếp UBND xã/phường
  nơi bạn cư trú.
• Kết quả tra cứu hồ sơ, trạng thái xử lý và mốc thời gian đều là kết quả mô phỏng.
• Ứng dụng không có hoạt động mua bán, không thu phí, không thanh toán, không phát
  sinh nghĩa vụ pháp lý nào cho người dùng.
• Khi mở ứng dụng sẽ có thông báo xác nhận đây là bản demo; các màn hình mô phỏng
  đều gắn nhãn "Demo".
• Dữ liệu của bản demo có thể được đặt lại bất kỳ lúc nào mà không báo trước.

CÁC TÍNH NĂNG ĐƯỢC MÔ PHỎNG
1. Gửi phản ánh — chụp ảnh hiện trường, chọn vị trí trên bản đồ, chọn lĩnh vực và
   gửi phiếu, nhận mã phiếu mô phỏng.
2. Phản ánh của tôi — theo dõi phiếu đã gửi qua từng bước trạng thái (mô phỏng).
3. Tra cứu hồ sơ — nhập mã biên nhận để xem tiến độ hồ sơ một cửa trên dữ liệu mẫu.
4. Tin tức — bản tin của chính quyền địa phương, nội dung mẫu.
5. Truyền thanh và Video — nghe bản tin truyền thanh, xem video, nội dung mẫu.
6. Danh bạ — số điện thoại các bộ phận, là số mẫu, không kết nối tới cơ quan thật.
7. Bản đồ kinh tế — điểm kinh doanh, dịch vụ hiển thị trên bản đồ, dữ liệu mẫu.

QUYỀN ỨNG DỤNG SỬ DỤNG VÀ LÝ DO
• Số điện thoại Zalo — định danh phiên trải nghiệm để lưu lại các phiếu bạn đã gửi
  thử trong app.
• Vị trí — gắn toạ độ vào phiếu phản ánh mô phỏng khi bạn chọn.
• Camera và thư viện ảnh — đính kèm ảnh vào phiếu phản ánh mô phỏng.
Dữ liệu chỉ được dùng trong phạm vi bản demo, không chia sẻ cho bên thứ ba, và
được xoá khi người dùng yêu cầu.

LIÊN HỆ
Đơn vị phát triển: <tên công ty>
Email hỗ trợ: <email hỗ trợ>
Điều khoản sử dụng: <URL trang điều khoản>
```

---

## 4. Chế độ demo trong mã nguồn

Bản demo và bản chính thức dùng **chung một mã nguồn**, phân biệt bằng một biến
môi trường duy nhất:

```
VITE_DEMO_MODE=true    # bản demo — mặc định, kể cả khi quên khai biến
VITE_DEMO_MODE=false   # bản chính thức
```

Khi bật, app tự làm bốn việc — không chỗ nào phải sửa tay:

| Việc | Ở đâu |
|---|---|
| Pop-up "Đây là ứng dụng DEMO" mỗi lần mở app, phải bấm "Tôi đã hiểu" mới dùng tiếp | `src/components/DemoIntroDialog.tsx` |
| Nhãn `DEMO` cạnh tiêu đề mọi màn (kể cả Trang chủ và màn định danh) | `DemoBadge` trong `src/components/common.tsx` |
| Dòng ghi chú "đây là dữ liệu mô phỏng" ở đầu 12 màn nghiệp vụ | `DemoNote` + `src/config/demo.config.ts` |
| Tên app thành "ViGov Demo", cả trong app lẫn `app-config.json` | `src/config/app.config.ts`, `scripts/zmp-prepare.mjs` |

Lời văn của pop-up và các dòng ghi chú nằm gọn trong `src/config/demo.config.ts`
— sửa câu chữ theo yêu cầu bên xét duyệt thì chỉ đụng tệp đó.

### Nơi khai biến

| Tệp | Dùng khi |
|---|---|
| `zalo-miniapp/.env.local` | Build tại máy rồi `zmp deploy` — **đây là đường đang dùng để nộp Zalo** |
| `zalo-miniapp/.env.example` | Bản mẫu commit lên git |
| `.env` ở thư mục gốc | Docker Compose truyền vào build arg của image `zalo-miniapp` |
| `zalo-miniapp/Dockerfile`, `docker-compose.yml` | Đường đi của biến, đã khai sẵn |

Nhớ VITE_* **nhúng lúc build**: đổi giá trị phải build lại, không có chuyện sửa
biến rồi khởi động lại là xong.

### Chuyển sang bản chính thức

1. `VITE_DEMO_MODE=false`
2. `VITE_ORG_NAME` / `VITE_ORG_PARENT` về tên đơn vị thật — bản demo đang để
   `Xã Demo` / `Huyện Demo · Tỉnh Demo`, và giá trị dự phòng trong mã nguồn cũng
   là tên hư cấu. Bản demo hiển thị tên một xã có thật kèm tin tức, hồ sơ bịa ra
   chính là điều Zalo nêu khi từ chối hồ sơ.
3. Đổi icon về bộ chính (`icon-512.png`), thay cho `icon-demo-512.png`.
4. Build lại và nộp trên Zalo OA của đơn vị.

---

## 5. Còn lại khi nộp

| Việc | Trạng thái |
|---|---|
| Logo có chữ DEMO (`public/icon-demo-512.png`) | ✅ đã có |
| Pop-up xác nhận bản demo khi mở app | ✅ đã có |
| Nhãn "Demo" ở các màn mô phỏng | ✅ đã có |
| Tên đơn vị mẫu là tên hư cấu | ✅ đã có |
| Chọn danh mục **không** phải "Cơ quan nhà nước – Địa phương" | ⬜ thao tác trên Console khi nộp |
| Điền tên công ty, email hỗ trợ, URL điều khoản vào mô tả | ⬜ trước khi dán mô tả |
