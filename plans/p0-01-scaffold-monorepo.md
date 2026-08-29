# P0-01 — Scaffold cấu trúc dự án 3 module

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

Dựng khung 3 module chung 1 thư mục dự án (chưa init git): admin-web (Next.js), backend (NestJS monorepo), mobile (Flutter — Android + iOS). Chuẩn hoá cấu hình chung: .env.example, quy ước đặt tên, cấu trúc thư mục.

## Kế hoạch thực hiện

- [x] Tạo `admin-web/` bằng create-next-app (TypeScript, App Router, src-dir, ESLint, không Tailwind — dùng design token CSS từ mockup).
- [x] Tạo `backend/` khung NestJS monorepo: cấu trúc apps/ (api-gateway) + libs/ (shared), package.json, tsconfig, .env.example. Chưa cài dependency nặng — cài khi bắt đầu P3.
- [x] Tạo `mobile/` — ĐỔI HƯỚNG 27/08/2026: app công dân viết bằng **Flutter (Android + iOS)** thay Zalo Mini App; scaffold bằng flutter create (org vn.gov.vigov).
- [x] Mọi cấu hình (URL API, tên đơn vị, cổng, feature flag) đưa vào file config/env — không hardcode trong mã nguồn.
