---
description: Rà soát bảo mật ViGov — dữ liệu cá nhân, cách ly công dân, phân quyền, phiên, tệp, bí mật
argument-hint: "[phạm vi: diff | module | tệp | all] — bỏ trống thì rà diff hiện tại"
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# /ra-soat-bao-mat

Gọi `agents/ra-soat-bao-mat.md`. **Chỉ đọc và báo cáo** — không tự sửa trừ khi người
dùng yêu cầu tường minh.

## Phạm vi

| `$1` | Rà gì |
|---|---|
| bỏ trống | `git diff` hiện tại + tệp chưa commit |
| `diff` | như trên |
| tên module (`feedback`, `files`, `users`…) | toàn bộ module đó |
| đường dẫn tệp | tệp đó |
| `all` | cả 4 module (chậm — dùng khi chuẩn bị phát hành) |

## Sáu trục

1. **Dữ liệu cá nhân** — log PII, trả số chưa che, PII trong URL/tên tệp/khoá cache, trường nhạy cảm thiếu trong `REDACTED_FIELDS`
2. **Cách ly công dân** — bộ lọc chủ sở hữu **trong** truy vấn, `citizenPhone` từ phiên, trả 404 chứ không 403
3. **Phân quyền và phiên** — mọi route có `@RequirePermission` hoặc `@Public()`; token có `sid`; `roles.ts` ↔ `roles.config.ts`
4. **An toàn tệp** — `findPrivateById`, MIME thực thi được, chữ ký kiểm trước khi đọc, `timingSafeEqual`
5. **Bí mật và cấu hình** — secret hardcode, giá trị thật trong `.env.example`, secret trong `NEXT_PUBLIC_*`/`VITE_*`
6. **Nhật ký thao tác** — đường ghi ngoài HTTP có gọi `AuditService.record`

Chi tiết lệnh grep: `agents/ra-soat-bao-mat.md`

## Định dạng báo cáo

```
### Mức CAO — phải sửa trước khi phát hành
| Mã | Phát hiện | Tệp:dòng | Kịch bản khai thác | Cách sửa |

### Mức TRUNG BÌNH
### Mức THẤP
### Đã kiểm và không có vấn đề
```

Mỗi phát hiện phải có **kịch bản khai thác cụ thể**: ai làm gì thì lấy được gì.
Không báo cáo phát hiện chỉ dựa trên "có thể", "nên", "tốt hơn nếu".

## Sau khi rà

- Phát hiện mới → thêm vào `SECURITY.md` mục 2 với mã (`C-xx`/`TB-xx`/`T-xx`) + trạng thái
- Sửa xong một phát hiện → đổi **trạng thái**, **không xoá** dòng

## KHÔNG BAO GIỜ

- Ghi giá trị secret hay dữ liệu cá nhân thật vào báo cáo
- Đề xuất nới một chốt bảo mật đang có
- Đánh dấu hạng mục `SECURITY.md` là đã làm khi chưa kiểm chứng

→ `agents/ra-soat-bao-mat` · `SECURITY.md`
