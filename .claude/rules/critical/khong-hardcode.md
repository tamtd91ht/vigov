# Luật: Không hardcode
# Mức: TỐI QUAN TRỌNG | Cưỡng chế: BẮT BUỘC (có hook cảnh báo)
# Ngăn: không triển khai được cho xã thứ hai, đổi một danh mục phải sửa 20 tệp

## Vì sao là luật TỐI QUAN TRỌNG, không phải "quy ước đẹp"

ViGov được thiết kế để **một mã nguồn chạy cho nhiều xã/phường**. Mỗi xã có tên riêng,
cơ quan cấp trên riêng, danh mục lĩnh vực riêng, SLA riêng, toạ độ bản đồ riêng, cơ cấu
phòng ban riêng. Một chuỗi "UBND xã Tân Phú" nằm trong component là một lần phải sửa mã
và phát hành lại cho mỗi khách hàng mới. Với 11 phân hệ × 4 module, đó là lỗi không cứu
được về sau.

## Cái gì phải nằm ở cấu hình

| Loại | Nơi khai báo |
|---|---|
| Tên đơn vị, cơ quan cấp trên, tên viết tắt | biến môi trường → `app.config.ts` của từng module |
| URL API, URL bản đồ, URL kho tệp | biến môi trường → `app.config.ts` |
| Toạ độ / mức thu phóng bản đồ mặc định | `admin-web/src/config/map.config.ts`, `zalo-miniapp/src/config/` |
| Trạng thái, nhãn, màu (nhiệm vụ, văn bản, phản ánh, giải ngân) | `admin-web/src/config/status.config.ts` |
| Danh mục lĩnh vực phản ánh | `admin-web/src/config/sla.config.ts` · `zalo-miniapp/src/config/categories.ts` |
| SLA theo lĩnh vực | `sla.config.ts` (`defaultSlaRules`) — sửa được từ trang Cấu hình |
| Vai trò và bảng quyền | `libs/shared/src/auth/roles.ts` ↔ `admin-web/src/config/roles.config.ts` |
| Menu điều hướng | `nav.config.ts` của từng module |
| Hạn mức, TTL, ngưỡng | `configuration.ts` (backend) qua biến môi trường |
| Nhà cung cấp bên thứ 3 | biến `*_PROVIDER` + adapter → `skills/adapter-ben-thu-ba` |

## MUST

| # | Luật |
|---|------|
| 1 | Component / service **đọc** cấu hình, không **định nghĩa** cấu hình |
| 2 | Danh mục và trạng thái luôn lặp từ mảng cấu hình, không viết cứng từng nhánh `if`/`case` |
| 3 | Thêm một trạng thái / lĩnh vực mới → sửa **một** tệp cấu hình, và tệp đó là nguồn chuẩn cho cả 4 module (đồng bộ theo `skills/dong-bo-kieu-4-module`) |
| 4 | Màu tham chiếu CSS variable (`var(--blue)`), không viết mã màu rải rác |
| 5 | Giá trị mặc định của biến môi trường phải an toàn khi thiếu: `localhost`, rỗng, hoặc mặc định trung tính — **không** phải dữ liệu của một khách hàng cụ thể |
| 6 | Chuỗi hiển thị cho người dùng gom ở nơi có thể sửa được, không rải trong logic |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Tên xã/phường, tên lãnh đạo, tên phòng ban viết cứng trong component, service, hay schema |
| 2 | `http://localhost:3001` hay tên miền thật viết cứng trong mã gọi API |
| 3 | Số ngày SLA viết cứng trong hàm tính hạn |
| 4 | Nhãn trạng thái tiếng Việt viết cứng cạnh khoá trạng thái (`status === 'moi' ? 'Mới giao' : ...`) |
| 5 | Toạ độ trung tâm bản đồ viết cứng |
| 6 | Số điện thoại, email, địa chỉ của cơ quan viết cứng |
| 7 | Danh sách phòng ban / đơn vị viết cứng trong `<select>` |
| 8 | Mã màu hex rải trong component khi đã có CSS variable |

## Ngoại lệ được phép

- Hằng số **kỹ thuật** không phụ thuộc khách hàng: `MAX_PAYLOAD_CHARS`, tên header HTTP,
  định dạng mã hồ sơ, số vòng bcrypt. Đặt là `const` có tên rõ ở đầu tệp, không rải số ma thuật.
- Dữ liệu **mock/demo** trong `src/mocks/`, `lib/mocks/`, `seed-data/` — nhưng phải là dữ
  liệu giả rõ ràng, không phải dữ liệu thật của khách.

## Cách kiểm tra nhanh

`/kiem-tra-hardcode` — quét tên đơn vị, URL, số SLA, nhãn trạng thái, mã màu nằm ngoài
thư mục `config/`.

→ `bi-mat-cau-hinh.md` · `skills/dong-bo-kieu-4-module` · `skills/sla-va-trang-thai`
