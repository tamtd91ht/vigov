# Luật: Tiếng Việt hành chính và giọng điệu với người dân
# Mức: TỐI QUAN TRỌNG | Cưỡng chế: BẮT BUỘC
# Ngăn: sai chính tả / sai thuật ngữ trên giao diện của cơ quan nhà nước

## Vì sao đây là luật, không phải chuyện thẩm mỹ

Giao diện ViGov là **văn bản của cơ quan công quyền hiển thị cho người dân**. Một chữ
sai chính tả, một thuật ngữ dùng sai, một câu ra lệnh thay vì mời — đều là thứ người dân
chụp màn hình và cấp trên hỏi lại. Trong hành chính, dùng sai từ còn có thể làm sai nghĩa
pháp lý (ví dụ "khiếu nại" ≠ "tố cáo" ≠ "phản ánh, kiến nghị" — ba thủ tục khác nhau,
ba thời hạn khác nhau).

## MUST

| # | Luật |
|---|------|
| 1 | Mọi chuỗi hiển thị cho người dùng viết bằng **tiếng Việt có dấu, đúng chính tả**. Không viết không dấu, không viết tắt tuỳ ý |
| 2 | Dùng đúng thuật ngữ hành chính. Tra `data/glossary.md` trước khi tự đặt tên nghiệp vụ mới |
| 3 | Tên đơn vị hành chính viết đúng cấp: "xã", "phường", "UBND", "HĐND". Không viết "chính quyền địa phương" thay cho tên cụ thể |
| 4 | Thông báo lỗi cho **cán bộ**: nói rõ sai gì và làm gì tiếp. Ví dụ: "Bạn phải đổi mật khẩu tạm trước khi sử dụng hệ thống" |
| 5 | Thông báo cho **công dân**: lịch sự, trung tính, không dùng thuật ngữ kỹ thuật, không dùng thuật ngữ nội bộ. Gọi người dân là "Quý vị" hoặc dùng câu không chủ ngữ, không gọi "bạn" ở văn bản chính thức |
| 6 | Ngày tháng theo định dạng Việt Nam `dd/MM/yyyy`; giờ 24h; số dùng dấu phân cách nghìn theo chuẩn Việt Nam |
| 7 | Tiền tệ ghi rõ "đồng" hoặc "VNĐ", làm tròn tới đồng, không hiện số thập phân |
| 8 | Comment trong mã viết tiếng Việt theo văn phong đang có: giải thích **vì sao** và **hậu quả nếu làm sai**, không mô tả lại mã |
| 9 | Commit message: `type(scope): mô tả bằng tiếng Việt`, mô tả nói **kết quả nghiệp vụ**, không nói tên hàm |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Trộn tiếng Anh vào chuỗi hiển thị: "Loading...", "No data", "Submit", "Error 500" |
| 2 | Dùng lẫn lộn "phản ánh" / "khiếu nại" / "tố cáo" / "kiến nghị" — chúng là bốn thứ khác nhau |
| 3 | Dùng lẫn "văn bản đến" / "văn bản đi" / "đơn thư" / "hồ sơ" |
| 4 | Rò rỉ thuật ngữ kỹ thuật ra giao diện: "ObjectId", "token", "endpoint", "payload", "null", "undefined", "NaN" |
| 5 | Hiện thông báo lỗi kỹ thuật thô cho công dân (stack trace, mã lỗi Mongo, thông báo của SDK) |
| 6 | Giọng điệu ra lệnh hoặc quy trách nhiệm với công dân: "Bạn đã nhập sai", "Không được phép" — viết lại thành "Thông tin chưa đúng, Quý vị vui lòng kiểm tra lại" |
| 7 | Viết hoa toàn bộ để nhấn mạnh trong giao diện công dân |
| 8 | Dùng emoji trong giao diện Web Quản trị hoặc trong văn bản chính thức |

## Bốn thủ tục dễ nhầm — dùng đúng từ

| Từ | Nghĩa trong ViGov |
|---|---|
| **Phản ánh, kiến nghị** | Công dân báo một việc cần cơ quan xử lý (rác, đèn đường, trật tự). Đây là nghiệp vụ chính của phân hệ Phản ánh |
| **Khiếu nại** | Công dân không đồng ý với một quyết định hành chính đã ban hành. Thủ tục và thời hạn riêng theo Luật Khiếu nại |
| **Tố cáo** | Công dân báo hành vi vi phạm của cán bộ/tổ chức. Có yêu cầu bảo vệ người tố cáo |
| **Đơn thư** | Từ gộp dùng khi tiếp nhận tại bộ phận một cửa, chưa phân loại |

Chưa chắc thuộc loại nào thì **không tự phân loại** — hỏi, hoặc để trạng thái "chưa
phân loại" cho cán bộ quyết định.

## Kiểm tra trước khi kết thúc một task có giao diện

1. Đọc lại toàn bộ chuỗi mới thêm — có chữ nào sai dấu, sai chính tả?
2. Có chuỗi nào còn tiếng Anh?
3. Có thuật ngữ nào đang dùng khác với `data/glossary.md`?
4. Thông báo lỗi mới có dẫn người dùng làm gì tiếp không?

→ `data/glossary.md` · `skills/tiep-can-nguoi-cao-tuoi` · `khong-hardcode.md`
