# Phân hệ Nhiệm vụ — hiện trạng v1 và đề xuất nâng cấp v2

Nguồn: đọc mã tại commit `545f914`, nhánh `main`. Không chạy ứng dụng thật.
Phạm vi: `admin-web` phân hệ `/tasks`, backend module `tasks`, và các điểm chạm sang
phân hệ khác.

Mục 1–7 là **hiện trạng đã đối chiếu mã**. Mục 8–10 là **nhận định và đề xuất**, chưa
phải quyết định — mục 10 liệt kê những thứ phải hỏi khách trước khi làm.

---

## 1. Bản đồ màn hình

Toàn bộ phân hệ nằm trên **một route** `/tasks`; các "màn hình" còn lại là chế độ xem và
ngăn kéo (drawer) chồng lên trang đó.

| # | Màn hình | Dạng | Tệp |
|---|---|---|---|
| V1 | Khung trang + thanh lọc | Trang | `admin-web/src/features/tasks/TasksPage.tsx` |
| V2 | Kanban 5 cột | Chế độ xem | `admin-web/src/features/tasks/KanbanBoard.tsx` |
| V3 | Bảng danh sách | Chế độ xem | `admin-web/src/features/tasks/TaskTable.tsx` |
| V4 | Ngăn chi tiết — tab *Chi tiết* | Drawer | `admin-web/src/features/tasks/TaskDrawer.tsx` |
| V5 | Ngăn chi tiết — tab *Trao đổi & Nhật ký* | Drawer | `TaskDrawer.tsx:384-480` |
| V6 | Giao việc mới / Sửa nhiệm vụ | Drawer | `admin-web/src/features/tasks/TaskForm.tsx` |
| V7 | Xác nhận xoá mềm | Drawer | `TasksPage.tsx:532-571` |
| V8 | Thùng "Đã xoá" | Chế độ lọc của V1+V3 | `TasksPage.tsx:445-455` |

Route vào: `admin-web/src/app/(dashboard)/tasks/page.tsx` — bọc `Suspense` vì trang đọc
tham số `?code` bằng `useSearchParams`.

---

## 2. Chi tiết từng màn hình

### 2.1 V1 — Khung trang và thanh lọc

**Tiêu đề** (`TasksPage.tsx:332-344`): "Quản lý nhiệm vụ" · phụ đề "Theo dõi nhiệm vụ giao
từ kết luận họp, văn bản đến và phản ánh của người dân" · nút **Giao việc mới** (ẩn khi
đang xem thùng đã xoá).

**Bộ lọc** — tất cả gửi lên máy chủ, không lọc ở trình duyệt (`TasksPage.tsx:106-130`):

| Bộ lọc | Kiểu | Nguồn danh mục | Tham số API |
|---|---|---|---|
| Bộ phận | Chip, chọn **một** | `GET /catalogs/departments` | `department` |
| Người thực hiện | MultiSelect, chọn **nhiều** | `GET /catalogs/staff` | `assignee[]` |
| Mức ưu tiên | MultiSelect, chọn **nhiều** | `taskPriorities` | `priority[]` |
| Trạng thái | MultiSelect, chọn **nhiều** | `taskStatuses` | `status[]` |
| Khoảng thời gian | DateRangeFilter | — | `from` / `to` (theo `createdAt`) |
| Thùng dữ liệu | SegmentControl Đang dùng / Đã xoá | — | `deleted=true` |

Đổi bất kỳ bộ lọc nào đều đặt lại về trang 1 (`changeFilter`, `TasksPage.tsx:143-146`).
Nút **Xoá bộ lọc** chỉ hiện khi có ít nhất một bộ lọc đang áp dụng.

**Bên phải thanh lọc**: đếm `Hiển thị {n}/{total} nhiệm vụ` · nút **Xuất Excel** · segment
thùng dữ liệu · segment Kanban/Bảng.

**Phân trang** (`TasksPage.tsx:481-501`): Trang trước / `Trang x/y` / Trang sau, chỉ hiện
khi có nhiều hơn một trang. Cỡ trang khác nhau theo chế độ xem — Kanban 100, Bảng 20
(`TasksPage.tsx:61-63`).

**Mở sẵn theo mã**: `/tasks?code=NV-2601` mở luôn ngăn chi tiết. Tìm kiếm toàn cục và
trung tâm thông báo điều hướng sang đây bằng đường này (`TasksPage.tsx:186-190`).

**Thời gian thực**: nhận sự kiện `taskChanged` thì tải lại danh sách và bản chi tiết đang
mở (`TasksPage.tsx:196-201`).

### 2.2 V2 — Kanban

Năm cột cố định theo `taskStatuses`: Mới giao · Đang thực hiện · Chờ duyệt · Quá hạn ·
Hoàn thành. Đầu cột có chấm màu trạng thái và số thẻ trong cột.

Thẻ nhiệm vụ (`KanbanBoard.tsx:10-62`): vạch màu trên đầu theo **mức ưu tiên** · tên việc ·
nhãn nguồn · thanh tiến độ · hạn xử lý (đỏ khi trạng thái `qua`) · phần trăm · avatar và
tên người thực hiện. Bấm vào thẻ mở ngăn chi tiết.

Cột rỗng hiện "Không có nhiệm vụ". **Không kéo-thả** — đổi trạng thái chỉ làm được trong
ngăn chi tiết hoặc form sửa.

### 2.3 V3 — Bảng danh sách

Tám cột (`TaskTable.tsx:53-63`): Mã · Tên việc (kèm nhãn nguồn) · Người thực hiện ·
Bộ phận · Hạn · Tiến độ · Ưu tiên · Trạng thái.

Ô **Hạn** tính số ngày còn lại ngay tại trình duyệt từ chuỗi `dd/MM/yyyy`
(`TaskTable.tsx:15-22`); nhiệm vụ `xong` chỉ hiện ngày kèm nhãn "Đã hoàn thành". Dòng có
trạng thái `qua` nhận class `late`. Ở thùng đã xoá, cột Trạng thái hiện chip "Đã xoá" thay
cho trạng thái nghiệp vụ (`TaskTable.tsx:108-116`).

### 2.4 V4 — Ngăn chi tiết, tab *Chi tiết*

Đầu ngăn: tiêu đề nhiệm vụ · `{mã} · Hạn xử lý {ngày}` · chip trạng thái · chip mức ưu tiên.
Nhiệm vụ đã xoá hiện thêm hộp cảnh báo đỏ kèm người xoá và lý do (`TaskDrawer.tsx:258-265`).

| Khối | Nội dung |
|---|---|
| Mô tả nhiệm vụ | Rỗng thì hiện "Chưa có mô tả" |
| Người giao việc / Người thực hiện | Avatar + họ tên |
| Bộ phận chủ trì / Hạn xử lý | Hạn đỏ khi trạng thái `qua` |
| Cán bộ phối hợp | Danh sách chip; rỗng thì "Không có" |
| Nguồn liên kết | Chip loại nguồn + nhãn; `vb` và `pa` kèm nút mở phân hệ Văn bản / Phản ánh (`TaskDrawer.tsx:28-52`) |
| Nhiệm vụ con | Checkbox từng việc, tiêu đề `(x/y đã hoàn thành)`, thanh tiến độ tổng |

**Thanh nút dưới ngăn** — nhiệm vụ đang dùng: ô chọn trạng thái · **Cập nhật tiến độ** ·
**Sửa nội dung** · **Nhắc việc** (đang khoá) · **Xoá** (chỉ `tasks:admin`) · Đóng.
Nhiệm vụ đã xoá: chỉ **Khôi phục nhiệm vụ** (nếu `tasks:admin`) và Đóng.

"Cập nhật tiến độ" gửi đồng thời trạng thái đang chọn và tiến độ **tính lại từ checklist**
(`TaskDrawer.tsx:144-151`).

### 2.5 V5 — Ngăn chi tiết, tab *Trao đổi & Nhật ký*

Ba khối: danh sách ý kiến trao đổi + ô nhập (Enter để gửi) · Nhật ký xử lý (timeline) ·
Tệp đính kèm minh chứng.

Tệp đính kèm (`TaskDrawer.tsx:409-479`): mỗi tệp có tên, dung lượng, nút **Tải về**, nút gỡ.
Tệp lưu riêng tư nên tải về phải xin link ký sẵn (`getSignedUrl`) — thẻ `<a>` không gửi được
header xác thực. Bản ghi cũ chỉ có **tên** tệp thì hiện danh sách tên kèm chú thích không
tải về được. Ô tải lên ẩn hẳn với nhiệm vụ đã xoá.

### 2.6 V6 — Giao việc mới / Sửa nhiệm vụ

Một component cho cả hai việc, khác nhau ở giá trị khởi tạo và endpoint được gọi.

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| Tiêu đề nhiệm vụ | Có | |
| Người thực hiện | Có | Chọn từ danh bạ; chọn xong **tự điền bộ phận** (`TaskForm.tsx:122-134`) |
| Bộ phận chủ trì | Có | |
| Hạn xử lý | Có | `input type=date`, đổi sang `dd/MM/yyyy` khi gửi |
| Mức ưu tiên | Không | Mặc định Trung bình |
| Trạng thái | Không | **Chỉ hiện khi sửa**; nhiệm vụ mới luôn vào "Mới giao" |
| Mô tả | Không | |
| Nhiệm vụ con | Không | Thêm/bỏ từng dòng |

Khi sửa, form chỉ gửi **những trường thực sự đổi** (`diffOf`, `TaskForm.tsx:166-185`); không
đổi gì thì đóng form mà không gọi API, tránh ghi mục nhật ký rỗng.

Người thực hiện hoặc bộ phận đã rời danh mục vẫn được giữ lại làm một lựa chọn để không mất
giá trị cũ (`TaskForm.tsx:265-268`, `288-290`).

### 2.7 V7 — Xác nhận xoá mềm

Drawer riêng, nêu rõ xoá mềm giữ lại gì, ô **Lý do xoá** không bắt buộc, ghi vào nhật ký xử
lý. Nút Xác nhận xoá / Huỷ.

### 2.8 V8 — Thùng "Đã xoá"

Chọn segment "Đã xoá" thì tự chuyển sang chế độ Bảng và ẩn nút Giao việc mới. Danh sách đang
dùng và thùng đã xoá **loại trừ nhau** ở tầng truy vấn.

---

## 3. Điểm chạm ngoài phân hệ

| Nơi | Nội dung | Tệp |
|---|---|---|
| Tổng quan | Danh sách "Cần xử lý ngay", bấm vào điều hướng `/tasks` | `features/dashboard/UrgentList.tsx` |
| Tổng quan | Biểu đồ "Nhiệm vụ hoàn thành theo tháng" | `features/dashboard/MonthlyTasksChart.tsx` |
| Báo cáo | Biểu đồ nhiệm vụ theo bộ phận | `features/reports/DeptTaskChart.tsx` |
| Tìm kiếm toàn cục | Nhóm kết quả "nhiệm vụ", bấm vào mở `/tasks?code=…` | `services/search.service.ts` |
| Thông báo | Thông báo có `taskCode` dẫn tới `/tasks?code=…` | `services/notifications.service.ts:78-79` |
| Văn bản đến | Chuyển văn bản thành nhiệm vụ, ghi `linkedTaskCode` | `workflow.service.ts:84-133` |
| Phản ánh | Chuyển phiếu phản ánh thành nhiệm vụ | `workflow.service.ts:142-188` |
| Đồng bộ ngược | Nhiệm vụ `xong` → văn bản `xong`, phản ánh `resolved` | `workflow.service.ts:197-226` |
| Cron nhắc hạn | 07:00 hằng ngày, cảnh báo trước **3 ngày**, tự đánh dấu quá hạn | `workflow.service.ts:30`, `235-258` |

---

## 4. Hợp đồng API và quyền

| Phương thức | Đường dẫn | Quyền | Việc |
|---|---|---|---|
| GET | `/tasks` | `tasks:view` | Danh sách có lọc + phân trang |
| GET | `/tasks/export/excel` | `tasks:view` | Xuất Excel theo bộ lọc |
| GET | `/tasks/:code` | `tasks:view` | Chi tiết, kèm siêu dữ liệu tệp |
| POST | `/tasks` | `tasks:edit` | Giao việc mới |
| PATCH | `/tasks/:code` | `tasks:edit` | Sửa nội dung / trạng thái / tiến độ |
| PATCH | `/tasks/:code/checklist/:index` | `tasks:edit` | Tick việc con |
| POST | `/tasks/:code/comments` | `tasks:edit` | Thêm ý kiến trao đổi |
| POST | `/tasks/:code/attachments` | `tasks:edit` | Gắn tệp minh chứng |
| DELETE | `/tasks/:code/attachments/:fileId` | `tasks:edit` | Gỡ tệp |
| PATCH | `/tasks/:code/delete` | `tasks:admin` | Xoá mềm, mang lý do trong body |
| PATCH | `/tasks/:code/restore` | `tasks:admin` | Khôi phục |

Quyền theo vai trò (`libs/shared/src/auth/roles.ts` ↔ `admin-web/src/config/roles.config.ts`):

| Vai trò | Quyền trên `tasks` | Làm được gì |
|---|---|---|
| Quản trị hệ thống | `admin` | Toàn bộ, kể cả xoá / khôi phục |
| Lãnh đạo phê duyệt | `approve` | Xem, sửa — **không** xoá được |
| Chuyên viên xử lý | `edit` | Xem, sửa |
| Kế toán – giải ngân | `view` | Chỉ xem |
| Tiếp nhận một cửa | `view` | Chỉ xem |

Ghi chú: Phase 1 phân quyền theo **phân hệ**, không theo hành động — nên `approve` và `edit`
hiện làm được đúng như nhau trên nhiệm vụ. Phân quyền theo hành động là câu hỏi mở #12.

---

## 5. Mô hình dữ liệu

Collection `tasks`, kế thừa `SoftDeletable` (`libs/shared/src/schemas/task.schema.ts`).

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `code` | string, duy nhất | `NV-<năm 2 số><số thứ tự>`, ví dụ `NV-2601` |
| `title` | string | ≤ 500 ký tự |
| `sourceType` | enum `vb` `pa` `hop` | Mặc định `hop` |
| `sourceLabel` | string | Nhãn hiển thị nguồn |
| `sourceRefId` | string, có index | Id văn bản / phản ánh gốc |
| `assignee` · `department` · `assigner` | string, có index | Lưu **tên**, không phải id tài khoản |
| `collaborators` | string[] | Tên cán bộ phối hợp |
| `deadline` | string | `dd/MM/yyyy` — định dạng hiển thị |
| `deadlineAt` | Date, có index | Mốc hạn cho cron nhắc hạn, cuối ngày 23:59:59 |
| `progress` | number 0–100 | |
| `status` | enum `moi` `dang` `cho` `qua` `xong` | |
| `priority` | enum `cao` `tb` `thap` | |
| `checklist` | `{title, done}[]` | |
| `comments` | `{authorName, authorInitials, authorColor, time, content}[]` | `time` là **chuỗi đã định dạng** |
| `timeline` | `{title, meta, state}[]` | `meta` là chuỗi ghép `HH:mm dd/MM/yyyy · Người` |
| `attachments` | string[] | **Di sản** — chỉ tên tệp, không tải về được |
| `attachmentFileIds` | string[] | Mã tệp thật trong module Files |
| `isDeleted` · `deletedAt` · `deletedBy` · `deleteReason` | | `deletedBy` lưu **tên đăng nhập** |

Chỉ mục toàn văn: `{ title: 'text', description: 'text' }`.

---

## 6. Quy tắc nghiệp vụ đang chạy

| Quy tắc | Nơi thực thi |
|---|---|
| Tiến độ = số việc con đã xong / tổng việc con, làm tròn | `calcProgress`, cả backend và bản mock của FE |
| Tick hết việc con (100%) mà chưa `xong` → tự chuyển **Chờ duyệt** | `TasksService.toggleChecklistItem` |
| Chuyển trạng thái sang `xong` → tiến độ ép về 100% | `TasksService.update` |
| Cron 07:00 hằng ngày: quá hạn → `status = 'qua'` + ghi nhật ký | `workflow.service.ts:235`, `TasksService.markOverdue` |
| Cảnh báo sắp đến hạn: còn ≤ 3 ngày | `DEADLINE_WARNING_DAYS` |
| Nhiệm vụ `xong` → cập nhật ngược bản ghi nguồn | `workflow.service.ts:197-226` |
| Sinh mã: lấy số thứ tự lớn nhất trong năm + 1, thử lại tối đa 5 lần khi trùng | `TasksService.generateCode` |
| Nhiệm vụ đã xoá mềm: mọi đường **ghi** trả 404; chỉ `GET /tasks/:code` còn đọc được | `TasksService.findByCode` |
| Tệp minh chứng bắt buộc `isPrivate = true`; tệp công khai bị từ chối | `TasksService.addAttachments` |
| Xuất Excel quá 5000 dòng → chặn và yêu cầu thu hẹp bộ lọc, không cắt bớt im lặng | `MAX_EXPORT_ROWS` |
| Sắp xếp danh sách: `createdAt` giảm dần, cố định | `TasksService.list` |
| Thời gian thực: chỉ phát tín hiệu khi **đổi trạng thái**, tạo, xoá, khôi phục | `TasksService.emitTaskChanged` |

Cột tệp Excel (`tasks.export.ts`): Mã · Tên · Bộ phận · Người thực hiện · Phối hợp · Ưu tiên ·
Trạng thái · Tiến độ · Hạn xử lý · Ngày giao · Nguồn. **Không** xuất mô tả và nhật ký.

---

## 7. Ràng buộc dữ liệu vào

| Trường | Ràng buộc |
|---|---|
| `title` | Bắt buộc, ≤ 500 ký tự |
| `description` | ≤ 5000 ký tự |
| `checklist[].title` | Bắt buộc, ≤ 300 ký tự |
| `deadline` | Đúng dạng `dd/MM/yyyy`; ngày không tồn tại bị từ chối ở `parseVnDate` |
| `priority` | Chỉ `cao` `tb` `thap` |
| `status` | Chỉ `moi` `dang` `cho` `qua` `xong` |
| `progress` | Số nguyên 0–100 |
| `content` (bình luận) | Bắt buộc, ≤ 2000 ký tự |
| `fileIds` | Không rỗng, tối đa 10 tệp mỗi lần |
| `limit` | Trần 100 bản ghi mỗi trang |

---

## 8. Hạn chế của v1 — đã đối chiếu mã

| # | Hạn chế | Bằng chứng | Hệ quả |
|---|---|---|---|
| H-01 | Trạng thái **Quá hạn** nằm chung enum với trạng thái nghiệp vụ | `task.schema.ts:111`, `markOverdue` | Cron ghi đè `dang`/`cho` thành `qua`; mất thông tin việc đang ở bước nào, và không quay lại được khi gia hạn |
| H-02 | Trang danh sách **không có ô tìm từ khoá** | `TasksPage.tsx:106-130` không truyền `q` | API và tìm kiếm toàn cục đã hỗ trợ `q`, nhưng trong phân hệ phải lọc thủ công |
| H-03 | Lọc thời gian tính theo **ngày giao**, không lọc theo hạn xử lý | `buildListFilter` dùng `buildDateRangeFilter('createdAt', …)` | Không trả lời được câu hỏi thường gặp nhất: "việc nào đến hạn tuần này" |
| H-04 | Số đếm trên cột Kanban chỉ tính trong trang đã tải (tối đa 100) | `KANBAN_PAGE_SIZE = 100`, `MAX_PAGE_SIZE = 100` | Quá 100 nhiệm vụ thì con số trên đầu cột **sai** so với thực tế |
| H-05 | Kanban không kéo-thả | `KanbanBoard.tsx` chỉ có `onClick` | Đổi trạng thái phải mở ngăn chi tiết — thao tác chính của Kanban lại là thứ làm chậm nhất |
| H-06 | Nút **Nhắc việc** khoá cứng | `TaskDrawer.tsx:212-219` | Nút hiện trên giao diện nhưng không dùng được; chưa có endpoint |
| H-07 | Người nhận việc **không được thông báo** khi được giao | Không có đường gửi trong `TasksService.create` | Cán bộ phải tự mở hệ thống mới biết có việc mới |
| H-08 | `assignee`, `department`, `assigner`, `collaborators` lưu bằng **chuỗi tên** | `task.schema.ts:94-121` | Đổi tên cán bộ hoặc tên bộ phận là đứt liên kết dữ liệu cũ; không truy được về tài khoản |
| H-09 | Backend **không kiểm** người thực hiện có trong danh bạ | `CreateTaskDto` chỉ `IsString` | Gọi API trực tiếp giao được việc cho người không tồn tại |
| H-10 | Tick việc con định danh bằng **chỉ số mảng** | `PATCH /tasks/:code/checklist/:index` | Hai người sửa cùng lúc thì tick nhầm việc khác |
| H-11 | Sửa checklist là **ghi đè cả mảng**, không có khoá phiên bản | `UpdateTaskDto.checklist`, `TasksService.update` | Người lưu sau xoá mất thay đổi của người lưu trước, không ai được báo |
| H-12 | `progress` và `checklist` có thể lệch nhau | `update` nhận `progress` tuỳ ý; `status='xong'` ép 100% | Thanh tiến độ 100% trong khi việc con chưa tick hết |
| H-13 | Bình luận lưu `time` là **chuỗi**, kèm `authorInitials`/`authorColor` | `task.schema.ts:19-36` | Không sắp xếp/lọc theo thời gian được; dữ liệu trình bày nằm trong CSDL |
| H-14 | Nhật ký xử lý lưu `meta` là **chuỗi ghép** người + thời gian | `buildTimelineStep` | Không truy vấn được "ai đã làm gì trong tháng"; báo cáo phải bóc chuỗi |
| H-15 | Bảng không đổi được cột sắp xếp | `TasksService.list` cố định `createdAt: -1` | Không xếp theo hạn, theo mức ưu tiên |
| H-16 | Mọi vai trò đều có `tasks:view` — kể cả Kế toán và Tiếp nhận một cửa | `roles.config.ts:15-18` | Nhiệm vụ sinh từ phản ánh mang **nội dung phản ánh của công dân** vào trường `description` (`workflow.service.ts:168`); mọi tài khoản cán bộ đều đọc được |
| H-17 | `tasks:edit` cho sửa **mọi** nhiệm vụ của **mọi** bộ phận | Guard chỉ kiểm mức quyền phân hệ | Chuyên viên bộ phận A sửa được việc của bộ phận B |
| H-18 | Chỉ `tasks:admin` xoá được | `tasks.controller.ts:182` | Giao nhầm một việc phải nhờ quản trị hệ thống xử lý |
| H-19 | Tín hiệu thời gian thực chỉ phát khi **đổi trạng thái** | `TasksService.update` | Sửa nội dung, thêm bình luận, đổi hạn thì màn hình người khác vẫn là bản cũ |
| H-20 | Hai nguồn sự thật cho hạn xử lý: `deadline` (chuỗi) và `deadlineAt` (Date) | `task.schema.ts:100-106` | Sửa một nơi quên nơi kia thì bảng hiển thị một đằng, cron tính một nẻo |
| H-21 | Trường `attachments` di sản vẫn còn | `task.schema.ts:135-143` | Hai chỗ chứa tệp, giao diện phải rẽ nhánh; bản ghi cũ không tải tệp về được |
| H-22 | Không lưu lịch sử **đổi người thực hiện** thành mốc riêng | `update` chỉ ghi nhật ký khi đổi trạng thái / tiến độ | Giao lại việc không để lại vết rõ ràng |

---

## 9. Đề xuất cho v2

Xếp theo thứ tự nên làm. Cột "Chặn" ghi việc phải xong trước.

### Nhóm A — Dữ liệu và nghiệp vụ (làm trước, vì đổi schema)

| # | Việc | Giải quyết | Chặn |
|---|---|---|---|
| A-1 | Tách **quá hạn** khỏi `status`: **suy ra** từ `deadlineAt` mỗi lần đọc, **không lưu cờ** — theo đúng nguyên tắc đã chốt ở phân hệ Giải ngân (`budget.schema.ts:17-26`: cờ lưu sẵn là cờ cũ) | H-01 | — |
| A-2 | Chuyển `assignee`/`assigner`/`collaborators` sang **id tài khoản**, giữ tên chỉ để hiển thị | H-08, H-09 | Cần script di trú + đối soát danh bạ |
| A-3 | Bỏ `deadline` chuỗi, giữ một mình `deadlineAt`; định dạng ở tầng hiển thị | H-20 | A-1 |
| A-4 | Việc con có **id ổn định** thay cho chỉ số mảng | H-10 | — |
| A-5 | Thêm khoá phiên bản lạc quan cho `update` (`version` / `updatedAt` gửi kèm) | H-11 | — |
| A-6 | `progress` là **giá trị suy ra** từ checklist, không nhận từ client | H-12 | A-4 |
| A-7 | Bình luận và nhật ký lưu `Date` + id người thực hiện; bỏ `authorColor`/`authorInitials` khỏi CSDL | H-13, H-14 | A-2 |
| A-8 | Dọn trường `attachments` di sản sau khi di trú bản ghi cũ | H-21 | Script di trú |

Mọi việc ở nhóm A đều đụng dữ liệu đang chạy → bắt buộc có script di trú, chế độ thử
(`--dry-run`) và bản sao lưu trước, theo `rules/critical/bao-toan-du-lieu.md`.

### Nhóm B — Giao diện

| # | Việc | Giải quyết |
|---|---|---|
| B-1 | Ô tìm từ khoá trên trang (`q` đã sẵn ở API) | H-02 |
| B-2 | Lọc theo **hạn xử lý**, tách khỏi lọc ngày giao | H-03 |
| B-3 | Kéo-thả Kanban để đổi trạng thái | H-05 |
| B-4 | Số đếm cột Kanban lấy từ API (thống kê theo trạng thái) thay vì đếm trong trang | H-04 |
| B-5 | Cho đổi cột sắp xếp ở chế độ Bảng | H-15 |
| B-6 | Ghi nhận mốc "đổi người thực hiện" vào nhật ký | H-22 |

### Nhóm C — Phân quyền và thông báo

| # | Việc | Giải quyết | Ghi chú |
|---|---|---|---|
| C-1 | Thông báo cho người nhận việc khi được giao | H-07 | Kênh nào (ZNS / đẩy / trong ứng dụng) là **câu hỏi mở #6** |
| C-2 | Endpoint nhắc việc, mở khoá nút đang treo | H-06 | Phụ thuộc C-1 |
| C-3 | Giới hạn phạm vi sửa theo bộ phận | H-17 | Phụ thuộc **câu hỏi mở #12** |
| C-4 | Cho `tasks:edit` xoá mềm nhiệm vụ **do chính mình giao** | H-18 | Phải khách chốt |
| C-5 | Che hoặc hạn chế đọc mô tả nhiệm vụ sinh từ phản ánh | H-16 | Chạm dữ liệu cá nhân — xem mục 10 |
| C-6 | Phát tín hiệu thời gian thực cho mọi thay đổi, không chỉ trạng thái | H-19 | — |

---

## 10. Phải hỏi khách trước khi làm v2

| # | Câu hỏi | Vì sao không tự quyết |
|---|---|---|
| 1 | Nhiệm vụ quá hạn rồi được gia hạn thì trạng thái quay về đâu? | Quy trình hành chính từng địa phương khác nhau |
| 2 | Ai được xoá nhiệm vụ — chỉ quản trị, hay cả người giao việc? | Liên quan trách nhiệm giải trình |
| 3 | Chuyên viên có được xem nhiệm vụ của bộ phận khác không? | Ảnh hưởng H-16, H-17 |
| 4 | Nhiệm vụ sinh từ phản ánh: cán bộ nào được đọc nội dung công dân trình bày? | Nghị định 13/2023/NĐ-CP — phải trả lời được "ai xem được" |
| 5 | Báo cho người nhận việc qua kênh nào? | Câu hỏi mở #6 |
| 6 | Phân quyền theo hành động (giao / duyệt / đóng) hay giữ theo phân hệ? | Câu hỏi mở #12 |
| 7 | Nhiệm vụ có cần SLA theo loại việc như phản ánh không? | Hiện hạn xử lý nhập tay từng việc |

Bảy câu trên **chưa được chốt trong mã**; làm trước khi có câu trả lời là đoán nghiệp vụ.
