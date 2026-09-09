---
name: realtime-socket
description: Dùng khi làm việc với Socket.IO, cập nhật realtime, phòng socket, thông báo tức thời trên Web Quản trị. Kích hoạt bởi: socket, Socket.IO, realtime, websocket, gateway, room, phòng, emit, thông báo tức thời, live update, WsAdapter.
---

# Kỹ năng: Realtime qua Socket.IO
# Mức: CAO | Ngăn: rò dữ liệu qua kênh realtime, kênh realtime bỏ qua phân quyền

## Phạm vi hiện tại

Ba sự kiện đã nối cho Web Quản trị (`modules/realtime/`). Phạm vi realtime đầy đủ vẫn là
**câu hỏi mở #7** — không tự mở rộng.

## Vì sao kênh realtime dễ rò dữ liệu

Guard HTTP (`JwtAuthGuard`) **không** áp cho kết nối socket. Nếu không tự xác thực và tự
phân phòng, một kết nối socket bất kỳ sẽ nhận mọi sự kiện — kể cả sự kiện về hồ sơ mà
người đó không có quyền xem. Đây là lỗ hổng dễ bỏ sót nhất vì nó không hiện trên bất kỳ
màn hình test API nào.

## MUST

| # | Luật |
|---|------|
| 1 | Xác thực token **ngay lúc handshake**; token không hợp lệ → từ chối kết nối, không nhận rồi mới lọc |
| 2 | Tra `SessionRegistry.isActive(sid)` lúc handshake — phiên đã thu hồi không được kết nối |
| 3 | Phân phòng theo **phạm vi quyền**: phòng theo phân hệ, hoặc theo đơn vị, hoặc theo `sid`. Không có phòng "tất cả" cho dữ liệu nghiệp vụ |
| 4 | Sự kiện gửi đi chỉ mang **mã nghiệp vụ + trạng thái mới**, client tự gọi API để lấy chi tiết (API đã có phân quyền và đã che dữ liệu) |
| 5 | Tên phòng **không** chứa dữ liệu cá nhân dạng rõ → `rules/critical/du-lieu-ca-nhan.md` |
| 6 | Ngắt kết nối khi phiên bị thu hồi (khoá tài khoản, đổi quyền) |
| 7 | Production: proxy phải chuyển tiếp `/socket.io/` (nginx) — nếu quên, realtime im lặng không hoạt động |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Phát sự kiện chứa nội dung hồ sơ, số điện thoại, hay nội dung đơn thư |
| 2 | `io.emit(...)` phát cho toàn bộ kết nối |
| 3 | Nhận tên phòng do client gửi rồi `socket.join(room)` — client tự chọn phòng là tự chọn dữ liệu để đọc |
| 4 | Dùng socket để **ghi** dữ liệu nghiệp vụ (không đi qua guard, không đi qua nhật ký thao tác) |
| 5 | Mở socket cho client công dân với dữ liệu chung — công dân chỉ được nhận sự kiện về hồ sơ của chính mình |
| 6 | Mở rộng số sự kiện realtime khi câu hỏi mở #7 chưa chốt |

## Mẫu phân phòng

```ts
/*
 * Phòng theo phân hệ + đơn vị. VÌ SAO không phát chung: một sự kiện "phiếu phản
 * ánh đổi trạng thái" chỉ được tới cán bộ có quyền xem phân hệ Phản ánh; cán bộ
 * chỉ làm CMS mà nhận sự kiện đó là rò thông tin nghiệp vụ.
 */
const rooms = MODULES
  .filter((m) => hasPermission(user.roleKey, m, 'view'))
  .map((m) => `phan-he:${m}`);
socket.join(rooms);
```

→ `rules/critical/phan-quyen-rbac.md` · `skills/phien-va-token` · `skills/trien-khai-docker`
