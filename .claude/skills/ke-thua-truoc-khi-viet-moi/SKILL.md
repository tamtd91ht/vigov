---
name: ke-thua-truoc-khi-viet-moi
description: Dùng trước khi viết một hàm tiện ích, component, hằng số, hay kiểu dữ liệu mới — tìm xem đã có chưa, đặt ở đâu cho đúng. Kích hoạt bởi: hàm tiện ích, helper, utility, tái sử dụng, trùng lặp, duplicate, viết mới, đặt ở đâu, libs/shared, components/ui, DRY, refactor gom.
---

# Kỹ năng: Tái sử dụng trước khi viết mới
# Mức: CAO | Ngăn: cùng một logic tồn tại 3 bản, sửa một bản còn hai bản vẫn sai

## Bằng chứng đây là vấn đề thật trong dự án này

`maskPhone` — hàm che số điện thoại — hiện tồn tại **ba bản** ở
`users.service.ts:112`, `feedback.service.ts:667`, `dossiers.service.ts:77`.
Bản thứ ba còn có comment "GIỮ NGUYÊN cách của UsersService.maskPhone", tức là người viết
đã biết đang nhân bản. Hậu quả: sửa cách che ở một chỗ, hai chỗ còn lại vẫn lộ theo cách
cũ, và không có test nào bắt được sự lệch đó.

## Tìm ở đâu trước khi viết

| Cần gì | Tìm ở |
|---|---|
| Hàm tiện ích backend | `backend/libs/shared/src/` (`auth`, `config`, `events`, `schemas`, `zalo`) |
| Kiểu dữ liệu nghiệp vụ | `admin-web/src/types/index.ts` (nguồn chuẩn) |
| Component giao diện | `admin-web/src/components/{ui,layout}/` |
| Hằng số nghiệp vụ, danh mục, trạng thái | `<module>/src/config/` |
| Logic gọi API | `<module>/src/services/` |
| Widget Flutter dùng chung | `mobile/lib/widgets/` |
| Kiểm quyền | `libs/shared/src/auth/roles.ts` — `hasPermission()` |
| Che dữ liệu cá nhân | → `skills/che-du-lieu-ca-nhan` |

Cách tìm nhanh: `codegraph_search` theo tên khái niệm, hoặc `grep` theo **nghĩa** chứ
không theo tên chính xác (`grep -rn "che số\|mask\|redact"`).

## MUST

| # | Luật |
|---|------|
| 1 | Trước khi viết hàm tiện ích: tìm bằng ít nhất **hai** từ khoá khác nhau (tên tiếng Anh + tên tiếng Việt trong comment) |
| 2 | Tìm thấy bản tương tự → **dùng lại**, hoặc mở rộng bản đó, không viết bản thứ hai |
| 3 | Cần dùng ở **hai** module backend → đặt ở `libs/shared` |
| 4 | Cần dùng ở **hai** phân hệ admin-web → đặt ở `components/ui` hoặc `lib/` |
| 5 | Phát hiện một logic đã tồn tại nhiều bản **trong lúc làm việc khác** → gom lại **nếu** đang chạm vào chỗ đó, giữ nguyên hành vi, giữ test hiện có xanh |
| 6 | Gom xong: cập nhật **mọi** nơi dùng trong cùng một commit, và ghi rõ trong commit message là đã gom |
| 7 | Có test cho bản gốc → giữ test đó, trỏ sang bản đã gom |

## MUST NOT

| # | Luật |
|---|------|
| 1 | Sao chép một hàm sang tệp khác rồi sửa nhẹ |
| 2 | Viết bản thứ hai với comment "giữ nguyên cách của bản kia" — đó là dấu hiệu phải gom, không phải cách hợp lệ |
| 3 | Gom logic khi **không** đang chạm vào chỗ đó (đó là refactor ngoài phạm vi → `rules` hành vi "sửa đúng phạm vi") |
| 4 | Đổi hành vi trong lúc gom — gom là giữ nguyên hành vi, đổi hành vi là việc riêng |
| 5 | Đưa vào `libs/shared` thứ chỉ một chỗ dùng (thư viện chung phồng lên là nợ khác) |
| 6 | Tạo tệp `utils.ts` / `helpers.ts` chung không có chủ đề — đặt tên theo việc (`privacy/mask.ts`, `time/working-days.ts`) |

## Ngoại lệ được phép nhân bản

- Kiểu dữ liệu ở 4 module khác nhau (không import chéo được) → nhân bản **có kiểm soát**
  theo `skills/dong-bo-kieu-4-module`
- Dữ liệu mock của từng module
- Mã sinh tự động

## Nợ đã biết — trả khi có dịp

| Nợ | Nơi | Gom về |
|---|---|---|
| `maskPhone` × 3 bản | `users` · `feedback` · `dossiers` service | `libs/shared/src/privacy/mask.ts` |

→ `skills/che-du-lieu-ca-nhan` · `skills/dong-bo-kieu-4-module` · `skills/nestjs-module-pattern`
