# P4-34 — Triển khai — CI/CD + hạ tầng staging/production

> Trạng thái: **done** · Nguồn: ESTIMATE_TECHNICAL.md · Tạo: 2026-08-27

## Mô tả

WBS #34–35 — Jenkins pipeline + Docker cho 3 module; hạ tầng staging + production (cloud hay on-premise — câu hỏi mở #6).

## Kế hoạch thực hiện

- [x] Jenkinsfile mỗi module; docker build + deploy staging→prod có approve.
- [x] Env tách staging/prod, secret không commit.
