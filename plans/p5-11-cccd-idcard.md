# P5-11 — Quét thông tin Căn cước công dân (CCCD)

> Trạng thái: **pending** · Tạo: 2026-08-30 · Liên quan: [p3-25-ocr.md](p3-25-ocr.md), [p5-09-third-party-providers.md](p5-09-third-party-providers.md)

## Mô tả

Cho phép lấy thông tin công dân từ thẻ CCCD thay vì gõ tay. Đây là **bài toán khác** với P3-25 (OCR văn bản hành chính) dù cùng nghe là "OCR" — khác nguồn dữ liệu, khác bộ trường, khác ràng buộc pháp lý.

## Quyết định kiến trúc

### 1. Dùng bên thứ 3, KHÔNG tự build mô hình OCR

Ba lý do, theo thứ tự sức nặng:

**Dữ liệu huấn luyện bất khả thi về pháp lý.** Tự train cần hàng chục nghìn ảnh CCCD thật đã gán nhãn — dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP. Không có nguồn hợp pháp để thu thập và lưu trữ kho ảnh đó với tư cách nhà thầu cho UBND xã.

**Đã thương mại hoá.** FPT.AI, VNPT eKYC, Viettel AI đều có endpoint đọc CCCD trả về trường có cấu trúc, đã xử lý loá sáng / nghiêng / mờ / ảnh chụp đêm bằng máy rẻ tiền. Đó là 90% công sức và bản tự làm sẽ kém hơn.

**Tự build không giải được vấn đề thật.** OCR chỉ đọc chữ in trên thẻ. Thẻ giả in đẹp thì OCR trả thông tin giả với confidence 0.98. Hệ thống hành chính công cần **xác thực**, không phải nhận dạng ký tự.

### 2. OCR là phương án CUỐI, không phải phương án chính

`zmp-sdk` (đã có sẵn trong `zalo-miniapp/package.json`) cung cấp hai API tốt hơn OCR:

```ts
declare enum ScanNFCType { cccd = 1 }
declare function scanNFC(args: { type: 'cccd'; data: { mrz: string }; skip_active_authen?: boolean }): Promise<any>
declare function scanQRCode(): Promise<{ content: string }>
```

Thiết kế 3 tầng, ưu tiên từ trên xuống:

| Tầng | Cơ chế | Chính xác | Chống giả | Chi phí | Yêu cầu |
|---|---|---|---|---|---|
| 1 | NFC đọc chip | Tuyệt đối | **Có** — Bộ Công an ký số | 0 | Máy có NFC + MRZ mặt sau |
| 2 | Quét QR mặt trước | Tuyệt đối | Không | 0 | Thẻ gắn chip còn QR đọc được |
| 3 | OCR bên thứ 3 | ~95% | Không | Theo lượt gọi | Hợp đồng + khoá API |

Tầng 1 và 2 **miễn phí, không sai số, không gửi dữ liệu công dân ra ngoài**. Đẩy được bao nhiêu lưu lượng xuống hai tầng này thì giảm bấy nhiêu chi phí API và rủi ro pháp lý. Tầng 3 chỉ dùng cho: CMND 9/12 số cũ, thẻ hỏng QR, và luồng cán bộ nhập tại quầy trên admin-web từ bản scan.

**Ghi chú tầng 1:** `scanNFC` cần MRZ (mặt sau thẻ, chuẩn ICAO 9303 TD1) làm khoá giải mã BAC. MRZ dùng font OCR-B có chữ số kiểm tra nên đọc dễ hơn chữ thường; hoặc cho người dùng gõ 3 trường (số CCCD, ngày sinh, ngày hết hạn) để tự dựng MRZ.

**Ghi chú tầng 2:** QR trên CCCD gắn chip mã hoá các trường ngăn bằng `|` — số CCCD, số CMND cũ, họ tên, ngày sinh, giới tính, nơi thường trú, ngày cấp. **PHẢI xác minh lại bằng thẻ thật**, gồm cả thẻ Căn cước cấp sau 01/7/2024 (Luật Căn cước 2023) vì chưa rõ định dạng có giữ nguyên không.

### 3. Tách module riêng, không nhét vào OcrProvider

`integrations/ocr/ocr.provider.ts` hardcode `OCR_FIELD_DEFS` là 7 trường văn bản hành chính (`refNo`, `issuedDate`, `sender`, `summary`, `deadline`, `confidentiality`, `urgency`) — không khớp trường nào của thẻ căn cước. Nhồi chung sẽ hỏng cả hai.

Tạo `integrations/idcard/` song song, cùng khuôn mẫu đang dùng:

```
integrations/idcard/idcard.provider.ts   IdCardProvider interface + MockIdCardProvider
integrations/idcard/idcard.service.ts    chọn provider theo config `idcard.provider`
```

Đăng ký trong `integrations.module.ts`. Giữ nguyên `OcrService` cho văn bản đến.

## Ràng buộc pháp lý — chốt TRƯỚC khi code tầng 3

Gửi ảnh CCCD lên cloud bên thứ 3 là **chuyển dữ liệu cá nhân cho bên xử lý**. Theo NĐ 13/2023 cần có sự đồng ý của chủ thể dữ liệu và hợp đồng xử lý dữ liệu với nhà cung cấp. Nhiều đơn vị còn yêu cầu dữ liệu không rời hạ tầng trong nước hoặc phải on-prem.

Phải hỏi khách **trước khi chọn nhà cung cấp**, vì nếu bắt buộc on-prem thì mua SDK cài tại chỗ chứ không dùng API cloud — khác hẳn về giá và công tích hợp. Ghép vào câu hỏi mở #1.

## Kế hoạch thực hiện

Thứ tự theo tỷ lệ giá trị / công sức:

- [ ] **Tầng 2 — QR trước.** Phủ rộng nhất (mọi máy, không cần NFC), chi phí 0, không phụ thuộc khách chốt gì. Gồm: `scanQRCode()` ở mini app, hàm parse chuỗi `|` có kiểm tra định dạng, màn xác nhận cho người dùng sửa trước khi lưu.
- [ ] Xác minh định dạng QR bằng thẻ thật — cả CCCD gắn chip và Căn cước sau 01/7/2024.
- [ ] **Khung `IdCardProvider` + `MockIdCardProvider` + `IdCardService`**, đăng ký trong `integrations.module.ts`, theo đúng khuôn `OcrProvider`.
- [ ] **Tầng 1 — NFC.** Luồng lấy MRZ (gõ tay 3 trường trước, đọc MRZ tự động sau), gọi `scanNFC`, xử lý máy không hỗ trợ NFC bằng cách rơi xuống tầng 2.
- [ ] Hỏi khách về ràng buộc dữ liệu cá nhân và on-prem (câu hỏi mở #1).
- [ ] **Tầng 3 — OCR.** Chỉ làm sau khi khách chốt nhà cung cấp và ký hợp đồng xử lý dữ liệu.
- [ ] Rà soát bảo mật: nhật ký không ghi số CCCD dạng rõ, ảnh thẻ không lưu quá thời hạn cần thiết — bổ sung mục vào `SECURITY.md`.

## Rủi ro

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Định dạng QR khác giữa CCCD gắn chip và Căn cước 2024 | Parse sai, dữ liệu lệch trường | Xác minh bằng thẻ thật trước khi code; parser kiểm tra số trường và định dạng ngày, sai thì rơi xuống nhập tay |
| `scanNFC` phụ thuộc phiên bản Zalo và phần cứng | Tầng 1 không dùng được trên máy cũ | Luôn có đường lui xuống tầng 2 và nhập tay; không thiết kế luồng bắt buộc NFC |
| Khách yêu cầu on-prem muộn | Phải đổi nhà cung cấp, làm lại tích hợp | Hỏi sớm; interface `IdCardProvider` cô lập thay đổi trong một tệp adapter |
| Dữ liệu CCCD lộ qua log hoặc bản sao lưu | Vi phạm NĐ 13/2023 | Che số CCCD trong log; đặt hạn xoá ảnh thẻ; ghi vào `SECURITY.md` |
