# ViGov Backend — NestJS monorepo (P3)

> Khung dự án dựng ở P0 (task `P0-01`). Việc code các service thuộc các task `P3-21` … `P3-31` trong `../pending-tasks.json` — bắt đầu bằng `npm install` rồi triển khai theo plan tương ứng trong `../plans/`.

## Kiến trúc

```
backend/
├─ apps/
│  └─ api-gateway/        # REST gateway cho admin-web + miniapp (JWT, RBAC, rate-limit)
│     └─ src/
│        ├─ main.ts       # bootstrap — đọc PORT/API_PREFIX từ env, không hardcode
│        ├─ app.module.ts # ConfigModule.forRoot + Mongoose + Throttler
│        └─ modules/      # vertical slice theo phân hệ:
│           tasks/  documents/  disbursement/  feedback/
│           content/  users/  reports/  search/  audit/
├─ libs/
│  └─ shared/             # DTO, schema Mongoose, auth guard, event contract RabbitMQ
├─ docker-compose.yml     # MongoDB + RabbitMQ cho môi trường dev
└─ .env.example           # toàn bộ cấu hình qua biến môi trường
```

- **Vertical slice**: mỗi phân hệ 1 module (controller + service + schema) — khớp 1-1 với các trang admin-web.
- **Event-driven** (P3-30): luân chuyển xuyên phân hệ (văn bản→việc, phản ánh→việc) và notification (P3-23) đi qua RabbitMQ.
- **Adapter bên thứ 3**: OCR / GIS / ZNS đều là interface + provider đọc từ env (`OCR_PROVIDER=mock|...`) — khớp câu hỏi mở #1, #2, #3.
- **Types đồng bộ FE**: schema tham chiếu `admin-web/src/types/index.ts` — giữ tên field khi triển khai.

## Chạy dev

```bash
docker compose up -d   # mongo + rabbitmq
cp .env.example .env
npm install
npm run start:dev
```

## Kiểm thử

| Lệnh               | Phạm vi                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| `npm test`         | Unit test (`*.spec.ts` cạnh mã nguồn trong `apps/`, `libs/`) — model Mongoose dùng mock, KHÔNG chạm cơ sở dữ liệu. Cấu hình: `jest.config.js`. |
| `npm run test:e2e` | Test đầu-cuối (`test/*.e2e-spec.ts`) — dựng cả AppModule trên MongoDB in-memory. Cấu hình: `test/jest-e2e.json`. |

Hai nhóm chạy độc lập: `jest.config.js` giới hạn `roots` ở `apps/` + `libs/` nên
không nhặt phải test e2e, và ngược lại.

`test/support/e2e-tmpdir.js` (globalSetup của e2e) chuyển thư mục tạm sang
`backend/.tmp-e2e` — mongodb-memory-server cấp phát trước 100MB journal, nếu để
ở thư mục tạm hệ điều hành thì máy gần đầy ổ sẽ làm toàn bộ e2e đỏ oan.
