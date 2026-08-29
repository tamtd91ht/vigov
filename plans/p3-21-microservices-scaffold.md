# P3-21 — Backend — Thiết kế micro-services + scaffold

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #21 — Monorepo NestJS: api-gateway + services theo phân hệ (tasks, documents, disbursement, feedback, content, users), MongoDB, RabbitMQ, shared libs (auth, dto, config). Docker compose dev.

## Kế hoạch thực hiện

- [x] NestJS monorepo (apps/ + libs/), config module đọc env — không hardcode.
- [x] MongoDB schemas theo types đã định nghĩa ở admin-web (`src/types`).
- [x] RabbitMQ event bus; docker-compose: mongo, rabbitmq, services.
- [x] Auth JWT + RBAC guard đồng bộ roles.config với FE.
