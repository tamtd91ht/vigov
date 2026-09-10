# ViGov — Phát hành Zalo Mini App

Kênh công dân duy nhất của ViGov là **Zalo Mini App**. Tài liệu này gộp toàn bộ việc
phát hành: điều kiện cần, cấu hình trước khi build, nộp kiểm duyệt, khai báo trên Zalo
Developers, và rủi ro lịch.

> **Cập nhật 09/09/2026** — dự án đã bỏ app Flutter (`mobile/`), nên hai kênh Google
> Play và App Store không còn áp dụng.

Tài liệu liên quan: `09-ZALO-XIN-QUYEN-API.md` (hồ sơ xin quyền) ·
`10-ZALO-MO-TA-BAN-DEMO.md` (nội dung nộp bản demo) · `11-ZALO-4-QUYEN-API.md` (tờ làm
việc từng quyền).

---

## 1. Điều kiện cần có trước

| Hạng mục | Ai lo | Ghi chú |
|---|---|---|
| Zalo Official Account của UBND xã | Khách hàng | Nên xác thực OA (tick xanh) — cơ quan nhà nước thường được yêu cầu |
| Tài khoản Zalo Developers | Khách hàng | Liên kết với OA ở trên |
| Mini App ID | Khách hàng | Tạo tại developers.zalo.me |
| Backend đã có HTTPS + tên miền | Đội triển khai | **Bắt buộc** — xem `04-TRIEN-KHAI-VPS.md` |
| Trang Chính sách quyền riêng tư (URL công khai) | Khách + đội | Bắt buộc để nộp |
| Giấy tờ đơn vị | Khách hàng | Zalo thường yêu cầu với Mini App của cơ quan nhà nước |
| Logo, ảnh chụp màn hình, mô tả | Đội soạn, khách duyệt | Xem mục 5 |

**Mini App KHÔNG chạy trên VPS của mình.** Bundle được tải thẳng lên hạ tầng Zalo và
phục vụ tại `h5.zdn.vn`. Dịch vụ `zalo-miniapp` trong `docker-compose.yml` chỉ để nội
bộ xem trước trên trình duyệt. VPS vẫn cần thiết vì Mini App gọi API backend.

---

## 2. Cấu hình trước khi build

### 2.1 Phía Mini App — `zalo-miniapp/.env.local`

```
VITE_API_BASE_URL=https://api-vigov.<tên-miền>/api/v1
VITE_USE_MOCKS=false
VITE_USE_MOCK_SDK=false
VITE_ZALO_APP_ID=<App ID lấy từ Zalo Developers>
VITE_ZALO_OA_ID=<OA ID>
```

> **Cạm bẫy đã sập một lần (10/09/2026).** Biến `VITE_*` được **nhúng vào bundle lúc
> build**, và `.env.local` không nằm trong git. Một lần build thiếu tệp này là bundle
> nuốt giá trị mặc định `http://localhost:3001/api/v1` — trong webview Zalo, localhost
> là chính chiếc điện thoại của người dân chứ không phải máy chủ, nên app báo "Không
> kết nối được máy chủ" ở màn liên kết số điện thoại. Bundle hỏng nhìn y hệt bundle
> tốt và chỉ lộ ra sau khi đã deploy.
>
> `npm run build` nay có **chốt chặn**: soi giá trị đã nhúng trong bundle và dừng build
> nếu trống hoặc trỏ localhost. Build đúng sẽ in ra dòng `API : https://…` — thấy dòng
> đó là chắc chắn bundle dùng được.

### 2.2 Phía backend — bật định danh Zalo thật

Trong `backend/.env.local` (hoặc `.env` gốc khi chạy Docker):

```
ZALO_APP_ID=<App ID>
ZALO_APP_SECRET=<App Secret>
ZALO_OA_ID=<OA ID>
```

> Chưa có `ZALO_APP_SECRET` thì backend không đổi được token Zalo sang số điện thoại,
> Mini App **tự rơi về** luồng nhập số + OTP. Chạy thử được nhưng **không phải luồng
> cuối cùng** — phải cấu hình trước khi nộp kiểm duyệt.

### 2.3 CORS — kiểm trước, đừng để phát hiện sau khi nộp

`CORS_ORIGINS` của backend **phải có `https://h5.zdn.vn`**. Thiếu là Mini App gọi API
bị trình duyệt chặn.

Kiểm chứng trên máy chủ thật:

```bash
curl -sI -X OPTIONS https://api-vigov.<tên-miền>/api/v1/health \
  -H 'Origin: https://h5.zdn.vn' \
  -H 'Access-Control-Request-Method: PATCH' | grep -i 'allow-methods\|allow-origin'
```

Kết quả phải có `https://h5.zdn.vn` **và** đủ `GET POST PATCH PUT DELETE OPTIONS`.

> **Thiếu `PATCH` là lỗi đã gặp thật.** Trình duyệt đọc danh sách này ở bước preflight;
> không thấy `PATCH` thì chặn ngay tại máy người dùng, request không bao giờ tới
> backend. Triệu chứng: thu hồi phiếu (POST) chạy được, cập nhật nội dung (PATCH) báo
> "hệ thống không phản hồi" — dù backend hoàn toàn khoẻ. Nguyên nhân thường là reverse
> proxy tự chèn bộ header CORS dùng chung đè lên header đúng của backend.
> → Cách xử lý: `06-VAN-HANH.md` mục "Xử lý sự cố".

---

## 3. Build và nộp

```bash
cd zalo-miniapp
npm install
npm run zmp:login      # mở trình duyệt, đăng nhập tài khoản Zalo Developers
npm run zmp:deploy     # build rồi tải bundle lên hạ tầng Zalo
```

`zmp:deploy` chạy `npm run build` trước nên bundle luôn khớp mã nguồn hiện tại.

Trước khi nộp, kiểm `zalo-miniapp/app-config.json`: tiêu đề, màu header, thanh trạng
thái. Tệp này do `scripts/zmp-prepare.mjs` cập nhật tự động sau mỗi lần build (trỏ tới
đúng tên bundle) — không sửa tay phần `listCSS` / `listSyncJS`.

---

## 4. Khai báo trên Zalo Developers

- **Quyền sử dụng**: số điện thoại, vị trí, camera/thư viện ảnh, quét QR — mỗi quyền
  phải nêu rõ mục đích. Zalo kiểm rất kỹ phần này; nội dung soạn sẵn ở
  `11-ZALO-4-QUYEN-API.md`.
- **Khai tên miền**: mọi tên miền Mini App gọi tới phải được khai trong danh sách domain
  — gồm **API backend** và **tên miền tile bản đồ**. Chưa khai thì lời gọi im lặng
  không chạy, không báo lỗi gì.
- **Ảnh chụp màn hình + mô tả**: xem mục 5.
- **Chính sách quyền riêng tư**: cần URL công khai — đặt trên
  `admin-vigov.<tên-miền>/privacy` hoặc trang thông tin của xã.
- **Tài khoản thử cho người kiểm duyệt**: Mini App định danh bằng số Zalo nên reviewer
  dùng chính tài khoản của họ; ghi rõ luồng sử dụng trong phần "Hướng dẫn cho người
  kiểm duyệt".
- **Khai dữ liệu thu thập**: số điện thoại (định danh), vị trí chính xác (gửi phản ánh),
  ảnh (ảnh hiện trường). Nêu rõ mục đích và việc không chia sẻ cho bên thứ ba.

---

## 5. Tài sản phát hành

| Hạng mục | Yêu cầu |
|---|---|
| Icon ứng dụng | Theo kích thước Zalo Developers yêu cầu tại thời điểm nộp |
| Ảnh chụp màn hình | Tối thiểu 4 ảnh: Trang chủ, Gửi phản ánh, Phản ánh của tôi, Tin tức |
| Tên hiển thị | "ViGov — Điều hành số cấp xã" (kiểm giới hạn ký tự) |
| Mô tả ngắn | Kênh tương tác giữa người dân và UBND xã: gửi phản ánh kèm ảnh và vị trí, theo dõi tiến độ xử lý, tra cứu hồ sơ một cửa, đọc tin tức và nghe truyền thanh của xã. |
| Mô tả dài | Nêu 6 nhóm tính năng, cam kết SLA xử lý phản ánh, thông tin đơn vị vận hành |
| Chính sách quyền riêng tư | URL công khai; nêu rõ dữ liệu thu thập, mục đích, thời gian lưu, quyền của người dùng |
| Thông tin liên hệ hỗ trợ | Email + tổng đài một cửa của xã |

Bản demo có bộ nội dung riêng → `10-ZALO-MO-TA-BAN-DEMO.md`.

---

## 6. Template ZNS — nộp song song, đừng chờ

Template ZNS được **duyệt riêng**, không đi cùng Mini App. Thời gian **vài ngày đến 1
tuần**. Cần 2 template (xem `backend/.env.example`):

| Biến | Nội dung |
|---|---|
| `ZNS_TEMPLATE_FEEDBACK_RECEIVED` | Xác nhận đã tiếp nhận phản ánh, kèm mã phiếu và cam kết thời hạn |
| `ZNS_TEMPLATE_FEEDBACK_RESOLVED` | Thông báo phản ánh đã xử lý xong, mời đánh giá |

Nộp ngay khi bắt đầu triển khai VPS để chạy song song. Chưa duyệt xong thì hệ thống vẫn
chạy, chỉ là công dân không nhận được tin nhắn Zalo.

---

## 7. Sau khi được duyệt

- [ ] Kiểm thử trên máy thật (Android + iPhone): định danh, gửi phản ánh kèm ảnh và
      GPS, quét QR.
- [ ] Xác nhận thông báo ZNS đến được sau khi cán bộ xử lý xong một phiếu.
- [ ] Theo dõi log backend vài ngày đầu: `docker compose logs -f backend`.
- [ ] Chạy bộ kịch bản hồi quy → `07-UAT-VA-NGHIEM-THU.md`.

---

## 8. Rủi ro lịch phát hành

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Zalo chậm duyệt template ZNS | Không gửi được thông báo cho công dân | Nộp template ngay khi code-complete; app vẫn chạy, chỉ thiếu thông báo |
| Zalo chưa cấp quyền `getPhoneNumber` | Định danh phải dùng mã OTP tạm, và mã đó hiện chỉ ghi ra log máy chủ | Xin quyền từ sớm; nêu rõ trong ghi chú gửi kiểm duyệt → `09-ZALO-XIN-QUYEN-API.md` |
| Bị từ chối vì thiếu mô tả quyền / giấy tờ đơn vị | Trễ 3–7 ngày mỗi vòng | Dùng checklist mục 4 trước khi nộp |
| Bị từ chối vì app mô phỏng thông tin cơ quan nhà nước | Đã xảy ra 05/09/2026 | Bản demo phải gắn nhãn rõ (`VITE_DEMO_MODE=true`) → `10-ZALO-MO-TA-BAN-DEMO.md` |
| Backend chưa có HTTPS/tên miền | Zalo từ chối | Hoàn tất TLS trước khi nộp → `04-TRIEN-KHAI-VPS.md` |
| Chưa khai tên miền (API hoặc tile bản đồ) | Lời gọi im lặng không chạy, không báo lỗi | Khai domain trước khi nộp, hoặc để `VITE_MAP_PROVIDER=mock` |
| Bundle build thiếu `.env.local` | App báo không kết nối được máy chủ | Chốt chặn trong `npm run build` đã chặn — xem mục 2.1 |

---

## 9. Thứ tự nên làm

```
Tuần 1  ─┬─ Khách: đăng ký OA + Zalo Developers, mua VPS, trỏ tên miền
         ├─ Khách: nộp template ZNS  ← lead time dài nhất, làm sớm nhất
         └─ Đội: dựng VPS (04-TRIEN-KHAI-VPS.md)

Tuần 2  ─┬─ Đội: nghiệm thu VPS, bật sao lưu
         └─ Đội: build và nộp Mini App (mục 2–4)

Tuần 3  ─┬─ Zalo kiểm duyệt (ngoài tầm kiểm soát)
         └─ Đội: chạy kịch bản hồi quy (07-UAT-VA-NGHIEM-THU.md)
```

Đường găng là **thời gian Zalo duyệt**, không phải công sức lập trình — nên việc phía
khách hàng ở mục 1 cần khởi động ngay từ ngày đầu.
