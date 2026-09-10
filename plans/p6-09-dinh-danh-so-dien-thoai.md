# P6-09 — Nghiệp vụ định danh số điện thoại công dân trên Zalo Mini App

> Trạng thái: **pending** · Lập 10/09/2026
> Phạm vi bản này: **chỉ thiết kế nghiệp vụ/luồng, chưa viết mã.**

## 1. Vì sao cần bản thiết kế này

Định danh là **cửa duy nhất** vào mọi dịch vụ cần danh tính của Mini App: gửi phản ánh,
tra cứu hồ sơ của mình, xem phiếu đã gửi, nhận thông báo. Nó cũng là nơi sinh ra
`citizenPhone` — khoá **duy nhất** cách ly dữ liệu giữa các công dân
(`rules/critical/cach-ly-du-lieu-cong-dan.md`). Sai ở đây không phải lỗi giao diện: nó
là công dân A đọc được đơn thư của công dân B.

Hiện luồng đã chạy được nhưng đang đứng trên hai thứ tạm bợ, và **cả hai đều phải biến
mất trước khi mở cho dân**:

| Thứ tạm | Ở đâu | Hậu quả nếu để nguyên |
|---|---|---|
| `CITIZEN_OTP_BYPASS_CODE` | `auth.service.ts` `matchesFallbackCode()` | Một mã cố định định danh được **bất kỳ số nào** — lối vào không qua xác thực thật (SECURITY.md mục 4, việc 0) |
| OTP chỉ ghi ra log máy chủ | `auth.service.ts` `requestOtp()` | Người dân bấm "Gửi mã" và không bao giờ nhận được gì |

Chúng tồn tại vì cùng một nguyên nhân: **Zalo chưa cấp quyền `getPhoneNumber`** (quyền
ID 100). Nên bản thiết kế phải phủ cả hai giai đoạn, và chuyển giữa chúng **bằng cấu
hình, không bằng sửa mã** — nếu không, ngày Zalo duyệt sẽ là một đợt sửa gấp vào đúng
đường nhạy cảm nhất của hệ thống.

## 2. Quyết định đã chốt với khách (10/09/2026)

| # | Câu hỏi | Đã chốt |
|---|---|---|
| 1 | Thiết kế cho giai đoạn nào | **Cả hai**, chuyển bằng công tắc cấu hình |
| 2 | Kênh gửi OTP thật | **Chưa chốt** → thiết kế qua adapter `OtpSender`, có bản `log` sẵn |
| 3 | Mở lại app khi đã định danh | **Tự vào**, im lặng gia hạn bằng refresh token |
| 4 | Số Zalo khác số muốn dùng | **Buộc dùng đúng số Zalo** khi đã có quyền `getPhoneNumber` |

Quyết định #4 đáng ghi rõ hệ quả: người dùng Zalo bằng một số nhưng muốn nhận thông báo
ở số khác **sẽ không làm được**. Đây là đánh đổi có chủ ý — cho đổi số tức là mở lại
đúng bề mặt tấn công mà `getPhoneNumber` sinh ra để đóng: tự khai số của người khác.
Ở giai đoạn A (chưa có quyền) ràng buộc này chưa áp được, vì OTP vốn là tự nhập số.

## 3. Hai giai đoạn

Một công tắc cấu hình duy nhất quyết định đường nào là đường chính. Đề xuất tên:
`CITIZEN_IDENTITY_MODE` = `otp` (giai đoạn A) | `zalo` (giai đoạn B).

### Giai đoạn A — chưa có quyền `getPhoneNumber` (hiện tại)

```
Mở app
  └─ chưa có phiên
       └─ Màn định danh
            ├─ [thử] gọi getPhoneNumber → Zalo không hiện popup, trả rỗng
            └─ rơi về đường OTP  ← ĐƯỜNG CHÍNH của giai đoạn này
                 ├─ B1. Nhập số điện thoại (10 số, bắt đầu bằng 0)
                 ├─ B2. Backend sinh mã 6 số → OtpSender gửi đi
                 ├─ B3. Nhập mã (tối đa 5 lần sai thì huỷ mã)
                 └─ B4. Cấp accessToken + refreshToken → vào app
```

### Giai đoạn B — Zalo đã cấp quyền `getPhoneNumber`

```
Mở app
  └─ chưa có phiên
       └─ Màn định danh
            └─ [nút] "Liên kết số điện thoại Zalo"  ← ĐƯỜNG CHÍNH
                 ├─ B1. SDK trả token dùng một lần
                 ├─ B2. Backend + ZALO_APP_SECRET đổi token lấy số tại Zalo Open API
                 ├─ B3. Chuẩn hoá số về 0xxxxxxxxx
                 └─ B4. Cấp accessToken + refreshToken → vào app
            └─ Zalo hỏng / người dân từ chối cấp quyền
                 └─ rơi về đường OTP (giữ nguyên, làm dự phòng)
```

Điểm mấu chốt: **hai giai đoạn dùng chung y hệt bước cấp token** (`issueCitizenToken`),
chỉ khác cách xác lập số điện thoại. Phần sau bước "đã biết số điện thoại đáng tin" là
một, không được nhân đôi.

## 4. Luồng lần mở app thứ hai trở đi (quyết định #3)

```
Mở app
  ├─ localStorage có phiên?
  │    ├─ Không → màn định danh
  │    └─ Có → gọi API bình thường
  │              ├─ 200 → vào thẳng, KHÔNG hỏi lại        ← trường hợp thường gặp
  │              └─ 401 → thử refresh im lặng (api.ts refreshOnce)
  │                        ├─ được → gọi lại, người dân không thấy gì
  │                        └─ hỏng → xoá phiên, về màn định danh
```

Cơ chế này **đã có sẵn** trong `api.ts` (`refreshOnce`, `SESSION_EXPIRED_EVENT`) và
`SessionContext`. Việc của task này là **kiểm chứng nó đúng trên thiết bị thật**, không
phải viết lại. Đặc biệt phải khẳng định: nhiều lời gọi song song lúc mở màn chỉ kích
hoạt **một** lượt refresh — gọi hai lượt là refresh token bị xoay vòng hai lần, backend
coi là dấu hiệu lộ token và **thu hồi cả phiên**, tức chính cơ chế gia hạn lại đá người
dân ra ngoài.

Không đặt hạn bắt định danh lại định kỳ (đã chốt #3). Lý do nghiệp vụ: người dùng chính
của Mini App gồm nhiều người cao tuổi, và ở giai đoạn A thì OTP còn **chưa gửi được
thật** — bắt xác thực lại định kỳ lúc này đồng nghĩa khoá người dân ra ngoài vĩnh viễn.

## 5. Kênh gửi OTP — adapter (quyết định #2)

Theo `skills/adapter-ben-thu-ba`: interface + provider + bản mock bắt buộc.

```
OtpSender (interface)
  ├─ log   ← mặc định hiện nay: ghi mã vào log máy chủ (CHỈ dùng khi phát triển)
  ├─ zns   ← Zalo Notification Service, cần OA đã xác thực + template được duyệt
  └─ sms   ← brandname nhà mạng, cần hợp đồng
```

Chọn bằng biến `OTP_SENDER_PROVIDER`. Tầng nghiệp vụ (`AuthService.requestOtp`) chỉ gọi
`otpSender.send(phone, code)` và **không biết** kênh nào đang chạy — đổi nhà cung cấp
chỉ sửa một tệp adapter.

Ràng buộc bắt buộc với mọi bản cài đặt:

- **Không** đưa mã OTP vào phản hồi HTTP, kể cả ở chế độ phát triển — nhánh đó sẽ theo
  lên production.
- Bản `log` phải **từ chối khởi động** khi `NODE_ENV=production`: ghi mã ra log ở môi
  trường thật là vừa vô dụng với người dân, vừa để mã dạng rõ nằm trong nhật ký.
- Kênh gửi hỏng (ZNS lỗi, hết quota) → người dân phải nhận được câu tiếng Việt nói rõ
  làm gì tiếp, **không** phải lỗi kỹ thuật thô.

## 6. Ràng buộc bảo mật (không thương lượng)

Rút từ `rules/critical/` và `skills/xac-thuc-otp-cong-dan`:

| # | Ràng buộc | Vì sao |
|---|---|---|
| 1 | Nguồn `citizenPhone` **duy nhất** là phiên đã xác thực (`req.user`) | Nhận từ body/query là mọi công dân đọc được dữ liệu của nhau |
| 2 | Chuẩn hoá số về `0xxxxxxxxx` **trước** khi so sánh và lưu | Không thì `+84987…` và `0987…` thành hai danh tính của cùng một người |
| 3 | Kho OTP chỉ lưu **HMAC**, không lưu mã dạng rõ | Lộ CSDL không được kèm lộ mã đang sống |
| 4 | Sinh mã bằng `crypto.randomInt()` | `Math.random()` đoán được |
| 5 | Đếm số lần nhập sai theo **mã**, tối đa 5 lần rồi huỷ | Đếm theo IP thì đổi IP là được thêm lượt |
| 6 | Giữ `AUTH_THROTTLE` 5 lượt/phút mỗi IP — **không nới** | Không gian mã chỉ 10⁶; đây là thứ duy nhất chặn dò |
| 7 | Một thông báo lỗi **duy nhất** cho mọi nhánh sai | Phân biệt "sai mã" với "hết hạn" là chỉ điểm cho người dò |
| 8 | Không ghi log mã OTP, số điện thoại dạng rõ | `rules/critical/du-lieu-ca-nhan.md` |
| 9 | Công dân **không** tự đổi số điện thoại | Đó là khoá cách ly dữ liệu; đổi số = di trú toàn bộ dữ liệu + ghi vết |
| 10 | Mỗi lần dùng mã tạm ghi `warn` kèm số đã che + IP | Phải truy được ai đã dùng lối vào tạm |
| 11 | Chạy nhiều instance → bắt buộc `OTP_STORE=mongo` | Driver `memory` giữ mã trong bộ nhớ tiến trình: mã sinh ở A không xác thực được ở B, và bộ đếm sai không dùng chung |

## 7. Nhật ký thao tác

Theo `rules/critical/nhat-ky-thao-tac.md`, các mốc phải ghi vết (`actor` là số điện
thoại **đã che**):

| Sự kiện | Mức |
|---|---|
| Định danh thành công (ghi rõ đường: `zalo` \| `otp`) | audit |
| Định danh thất bại quá số lần cho phép | warn |
| Dùng `CITIZEN_OTP_BYPASS_CODE` | **warn** — kèm IP |
| Tạo tài khoản công dân mới (lần định danh đầu tiên) | audit |
| Từ chối cấp token do tài khoản bị khoá / xoá mềm | warn |

Lưu ý cơ chế: `AuditInterceptor` chỉ tự bắt request HTTP ghi **thành công**. Nhánh thất
bại (nhập sai mã, tài khoản bị khoá) **không** được ghi tự động — phải gọi
`AuditService.record` tường minh.

## 8. Tiếng Việt hành chính trên màn định danh

Theo `rules/critical/ngon-ngu-hanh-chinh.md` — gọi người dân là "Quý vị" hoặc dùng câu
không chủ ngữ, không quy trách nhiệm:

| Tình huống | Câu hiện tại | Nhận xét |
|---|---|---|
| Sai định dạng số | "Số điện thoại gồm 10 chữ số và bắt đầu bằng 0" | Đạt — nói rõ phải làm gì |
| Sai mã | "Mã xác thực không đúng hoặc đã hết hạn" | Đạt — gộp mọi nhánh sai, đúng chủ ý |
| Mất mạng | "Không kết nối được máy chủ, vui lòng thử lại." | Đạt |
| Tài khoản bị khoá | "Tài khoản đã bị khoá. Vui lòng liên hệ UBND xã." | **Cần rà**: nên nêu số tổng đài để Quý vị biết gọi đâu |
| Hết lượt nhập | *(chưa có câu riêng)* | **Thiếu** — cần câu nói rõ phải xin mã mới |

Rà toàn bộ chuỗi mới ở bước cuối; không để lọt tiếng Anh hay thuật ngữ kỹ thuật
("token", "OTP" dùng được vì đã phổ biến, nhưng "endpoint", "payload" thì không).

## 9. Khả năng tiếp cận

Theo `skills/tiep-can-nguoi-cao-tuoi` — người dùng chính có cả người cao tuổi:

- Ô nhập mã: cỡ chữ lớn, giãn ký tự, `inputMode="numeric"` để hiện bàn phím số.
- Vùng chạm nút tối thiểu 44×44.
- Nút "Gửi lại mã" phải có, kèm đếm ngược để không bấm liên tục rồi dính hạn mức.
- Trạng thái chờ nói bằng lời ("Đang gửi mã…"), không chỉ có vòng xoay.
- Không dùng emoji, không viết hoa toàn bộ.

## 10. Kiểm chứng — phải chạy thật, không chỉ khai báo

Bộ ba kiểm tra bắt buộc cho mọi đường công dân
(`rules/critical/cach-ly-du-lieu-cong-dan.md`):

| # | Thử | Kết quả đúng |
|---|---|---|
| 1 | Gọi API dữ liệu công dân **không** kèm token | 401 |
| 2 | Đổi sang token của công dân khác, giữ nguyên mã hồ sơ trong URL | **404** (không phải 403 — 403 tiết lộ mã đó có tồn tại) |
| 3 | Đổi mã hồ sơ sang mã của người khác | **404** |

Thêm cho riêng luồng định danh:

| # | Thử | Kết quả đúng |
|---|---|---|
| 4 | Nhập sai mã 6 lần | Lần thứ 6 báo mã đã bị huỷ, phải xin mã mới |
| 5 | Gọi `/auth/citizen/otp/request` quá 5 lượt/phút cùng IP | 429 |
| 6 | Dùng lại refresh token đã xoay vòng | Cả phiên bị thu hồi |
| 7 | Mở app khi phiên còn sống | Vào thẳng, không hỏi lại |
| 8 | Mở app khi access token hết hạn, refresh còn sống | Vào thẳng, người dân không thấy gì |
| 9 | Ba lời gọi song song lúc mở màn, access token đã hết hạn | Chỉ **một** lượt refresh; phiên không bị thu hồi |
| 10 | Tài khoản bị quản trị viên khoá / xoá mềm rồi định danh lại | Từ chối, kèm câu tiếng Việt đúng |
| 11 | Số nhập dạng `+84987654321` | Chuẩn hoá về `0987654321`, không tạo danh tính thứ hai |

## 11. Việc phải làm khi Zalo cấp quyền (chuyển A → B)

Đúng thứ tự, theo `skills/xac-thuc-otp-cong-dan`:

1. Kiểm chứng `exchangeZaloToken()` chạy thật với token thật của Zalo.
2. Đặt `CITIZEN_IDENTITY_MODE=zalo`.
3. **Bỏ trống `CITIZEN_OTP_BYPASS_CODE` ở mọi môi trường.**
4. `SECURITY.md`: chuyển việc 0 sang "đã hoàn thành", đóng phát hiện T-08.
5. Cập nhật `docs/09-ZALO-XIN-QUYEN-API.md` và `docs/11-ZALO-4-QUYEN-API.md`.
6. Rà lại `AUTH_THROTTLE` — **giữ nguyên**, không nới.

## 12. Ngoài phạm vi task này

- Nối ZNS/SMS thật (phụ thuộc khách chốt kênh + hợp đồng) — task này chỉ dựng adapter.
- Đổi số điện thoại của tài khoản công dân đã có dữ liệu (di trú + ghi vết) — nghiệp vụ
  riêng, chưa có yêu cầu.
- Đăng nhập cán bộ trên Web Quản trị — khác hoàn toàn, dùng RBAC.

## 13. Câu hỏi mở còn treo

| # | Câu hỏi | Mặc định an toàn đang dùng |
|---|---|---|
| 1 | Kênh gửi OTP thật: ZNS hay SMS brandname? | Adapter `log`, chưa gửi thật |
| 2 | Quyền `getPhoneNumber` bao giờ được Zalo duyệt? | Giữ giai đoạn A, không xoá đường OTP |
| 3 | Người dùng Zalo bằng số khác số muốn dùng thì hỗ trợ ra sao? | Buộc dùng số Zalo (đã chốt #4); nếu phát sinh khiếu nại thực tế thì mở lại bàn |
| 4 | Hạn dùng phiên công dân bao lâu là hợp lý? | Theo `JWT_EXPIRES_IN` / `REFRESH_EXPIRES_IN` hiện có, chưa đổi |

## Kế hoạch thực hiện

- [ ] Chốt tên và vị trí công tắc `CITIZEN_IDENTITY_MODE` (backend `configuration.ts` +
      `.env.example`, và cờ tương ứng phía Mini App nếu cần đổi nhãn nút).
- [ ] Dựng adapter `OtpSender` (interface + provider `log`, chỗ cắm `zns`/`sms`), bản
      `log` chặn khởi động ở production.
- [ ] Rà `AuthService.requestOtp` / `verifyOtp` theo bảng ràng buộc mục 6, bổ sung chỗ
      thiếu (đặc biệt: ghi vết nhánh thất bại, câu báo hết lượt nhập).
- [ ] Rà `OnboardingPage` theo mục 8 và 9: câu chữ, nút gửi lại mã kèm đếm ngược, cỡ
      chữ và vùng chạm.
- [ ] Kiểm chứng luồng giữ phiên (mục 4) trên thiết bị thật, gồm ca 9 lời gọi song song.
- [ ] Viết test tự động cho 11 ca ở mục 10.
- [ ] Đồng bộ tài liệu: `docs/03-ZALO-MINIAPP.md`, `SECURITY.md`, `BAO-CAO-TIEN-DO.md`.

→ `rules/critical/cach-ly-du-lieu-cong-dan.md` · `rules/critical/du-lieu-ca-nhan.md` ·
`skills/xac-thuc-otp-cong-dan` · `skills/phien-va-token` · `skills/adapter-ben-thu-ba` ·
`skills/tiep-can-nguoi-cao-tuoi`
