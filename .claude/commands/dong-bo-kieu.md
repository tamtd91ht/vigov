---
description: Đối chiếu tên và kiểu trường dữ liệu giữa 4 module ViGov, tìm chỗ lệch
argument-hint: "[tên trường hoặc tên kiểu, ví dụ: citizenPhone | Task]"
allowed-tools: Read, Grep, Glob, Bash
---

# /dong-bo-kieu

## Vì sao cần lệnh này

TypeScript **không** bắt được lệch giữa bốn module — mỗi module biên dịch riêng, không
import chéo. Lệch trường chỉ hiện lúc chạy thật: ô trống trên giao diện, `undefined`
trong dữ liệu. Không có test nào tự bắt.

## Nguồn chuẩn

`admin-web/src/types/index.ts` — ba module còn lại khớp theo.

| Module | Nơi khai kiểu |
|---|---|
| `admin-web/` | `src/types/index.ts` ← **NGUỒN CHUẨN** |
| `backend/` | `*.schema.ts` + `dto/` + hàm map trả về |
| `zalo-miniapp/` | `src/types/` |
| `mobile/` | `lib/models/` (+ `fromJson`/`toJson`) |

## Lệnh

```bash
FIELD="${1:?cần tên trường}"

echo "=== nguồn chuẩn: admin-web/src/types/index.ts ==="
grep -n "$FIELD" admin-web/src/types/index.ts

echo "=== backend: schema + dto + map ==="
grep -rn "$FIELD" backend/apps/api-gateway/src --include=*.ts | grep -v spec

echo "=== admin-web ==="
grep -rn "$FIELD" admin-web/src --include=*.ts --include=*.tsx | grep -v "types/index.ts"

echo "=== zalo-miniapp ==="
grep -rn "$FIELD" zalo-miniapp/src --include=*.ts --include=*.tsx

echo "=== mobile ==="
grep -rn "$FIELD" mobile/lib --include=*.dart
```

Không truyền tham số → liệt kê toàn bộ tên trường trong `types/index.ts` rồi tìm những
tên **có ở backend nhưng không có** trong nguồn chuẩn (dấu hiệu trường mới chưa đăng ký).

## Kiểm gì

| # | Kiểm |
|---|------|
| 1 | Tên trường **giống nhau** ở cả 4 module (`camelCase` tiếng Anh) |
| 2 | Kiểu tương đương (chuỗi ↔ String, số ↔ int/double, ngày ↔ chuỗi ISO 8601) |
| 3 | Trường không có giá trị trả **chuỗi rỗng / mảng rỗng**, không `null` |
| 4 | Khoá trạng thái / danh mục là chuỗi ngắn không dấu; **nhãn** tiếng Việt ở cấu hình |
| 5 | Tiền là **số nguyên đơn vị đồng** ở mọi nơi |
| 6 | Enum nghiệp vụ: danh sách giá trị khớp giữa `@IsIn` của DTO và cấu hình client |

## Định dạng báo cáo

```
### Lệch — phải sửa
| Trường | Nguồn chuẩn | Module lệch | Đang là gì |

### Có ở backend nhưng chưa đăng ký ở types/index.ts
### Khớp (đã kiểm)
```

## Sửa lệch — sáu bước MỘT commit

`types/index.ts` → backend → admin-web → zalo-miniapp → mobile → `data/glossary.md`,
rồi `npm run check:all`. **Chia commit là để lại trạng thái lệch trong lịch sử.**

→ `skills/dong-bo-kieu-4-module` · `workflows/doi-truong-du-lieu`
