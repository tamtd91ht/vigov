---
description: Quét giá trị lẽ ra thuộc cấu hình nhưng đang nằm trong mã — tên xã, URL, SLA, nhãn trạng thái, màu, toạ độ
argument-hint: "[module: admin-web | zalo-miniapp | mobile | backend | all]"
allowed-tools: Read, Grep, Glob, Bash
---

# /kiem-tra-hardcode

Quét rộng hơn hook `hardcode_guard.py` (hook chỉ chạy khi sửa tệp, và đã cố ý bỏ một số
mẫu ồn như mã màu hex).

## Vì sao quan trọng

ViGov chạy **một mã nguồn cho nhiều xã/phường**. Mỗi giá trị riêng của một xã nằm trong
mã là một lần phải sửa mã và phát hành lại cho khách hàng mới.
→ `rules/critical/khong-hardcode.md`

## Lệnh quét

Loại trừ: `config/` · `mocks/` · `seed-data/` · test · `docs/` · `deploy/` · `node_modules`

```bash
BASE="admin-web/src zalo-miniapp/src backend/apps backend/libs"
EXCL="config/|mocks/|seed-data/|\.spec\.|\.test\.|/test/|node_modules|dist/"

# 1. Tên xã/phường CỤ THỂ (UBND/HĐND + cấp + tên riêng)
grep -rnE "(UBND|HĐND)[[:space:]]+(xã|phường|thị trấn|huyện|tỉnh)[[:space:]]+[A-ZĐ]" $BASE | grep -vE "$EXCL"

# 2. URL tuyệt đối (trừ nền tảng bên thứ ba)
grep -rnE "['\"\`]https?://" $BASE | grep -vE "$EXCL" | grep -viE "localhost|127\.0\.0\.1|youtube|ytimg|youtu\.be|vimeo|openfreemap|openstreetmap|tile|maplibre|unpkg|cdnjs|jsdelivr|zalo|zdn\.vn|googleapis|gstatic|w3\.org"

# 3. Số ngày SLA
grep -rnE "(intakeDays|resolveDays|slaDays|deadlineDays)[[:space:]]*[:=][[:space:]]*[0-9]" $BASE | grep -vE "$EXCL"

# 4. Toạ độ bản đồ
grep -rnE "(lat|lng|latitude|longitude)[[:space:]]*[:=][[:space:]]*(1[0-9]|2[0-3])\.[0-9]{3,}" $BASE | grep -vE "$EXCL"

# 5. Mã màu hex (nhiều — xem có nên chuyển sang CSS variable)
grep -rnE "['\"\`]#[0-9a-fA-F]{6}['\"\`]" $BASE | grep -vE "$EXCL|globals\.css"

# 6. Nhãn trạng thái tiếng Việt viết cứng cạnh khoá
grep -rnE "status[[:space:]]*===?[[:space:]]*['\"](moi|dang|cho|qua|xong|dangxl|choduyet)['\"]" $BASE | grep -vE "$EXCL"

# 7. Số điện thoại / email của cơ quan
grep -rnE "['\"\`]0(2[0-9]{1,2}|1[89]00)" $BASE | grep -vE "$EXCL"
```

## Phân loại kết quả — không phải mọi hit đều là lỗi

| Loại | Xử lý |
|---|---|
| **Giá trị riêng của một xã** (tên, toạ độ, SLA, số điện thoại cơ quan) | **Phải** chuyển sang cấu hình |
| Nhãn **chung cho mọi xã** ("Chủ tịch UBND xã", "Lãnh đạo UBND xã") | Được giữ |
| Endpoint cố định của nền tảng bên thứ ba (FCM, Zalo, YouTube, tile bản đồ) | Được giữ |
| Chuỗi ví dụ trong biểu mẫu ("VD: …") | Được giữ, nhưng nên là ví dụ trung tính |
| Màu trong biểu đồ | Nên chuyển sang CSS variable, không chặn |
| Hằng số **kỹ thuật** không phụ thuộc khách hàng | Được giữ — đặt `const` có tên rõ ở đầu tệp |
| Dữ liệu mock / seed rõ ràng là giả | Được giữ |

## Nợ đã biết

| Nợ | Nơi | Gom về |
|---|---|---|
| SLA mặc định lặp 2 nơi | `backend/.../settings/settings.service.ts` · `seed.ts` (lặp `admin-web/src/config/sla.config.ts`) | Một nguồn chuẩn |
| Toạ độ trung tâm viết cứng | `zalo-miniapp/src/services/zalo.ts` · `integrations/geo/geo.provider.ts` (`DAI_THANG_CENTER`) | Cấu hình bản đồ |

## Định dạng báo cáo

```
### Phải chuyển sang cấu hình
| Tệp:dòng | Giá trị | Chuyển về đâu |

### Nên chuyển (không chặn)
### Được giữ (đã kiểm, không phải lỗi)
```

→ `rules/critical/khong-hardcode.md` · `skills/dong-bo-kieu-4-module`
