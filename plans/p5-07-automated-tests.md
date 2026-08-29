# P5-07 — Kiểm thử tự động (thuộc hệ số QA 15%)

> Trạng thái: **done** · Bổ sung 28/08/2026 sau khi đối chiếu WBS gốc (`ViGov_Phase1_Req.xlsx`) với mã nguồn thực tế

## Mô tả

Hiện chỉ có 11 test e2e của backend. Bổ sung unit test cho nghiệp vụ dễ sai, test giao diện cho luồng chính và widget test cho app Flutter.

## Kế hoạch thực hiện

- [x] Backend: unit test cho sinh mã (NV/HM/#PA), tính SLA, parse tiền tệ, phân quyền RBAC, chống spam.
- [x] Backend: mở rộng e2e phủ workflow văn bản→việc, phản ánh→việc, xuất Excel.
- [x] admin-web: test component cho Kanban, drawer checklist, bộ lọc (Vitest + Testing Library).
- [x] mobile: widget test cho luồng gửi phản ánh 3 bước và trình phát truyền thanh.
- [x] Gắn toàn bộ vào Jenkinsfile và GitHub Actions, chặn merge khi test đỏ.
