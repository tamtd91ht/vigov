import '../models/models.dart';

/// Danh bạ chính quyền mẫu — đồng bộ danh bạ cán bộ của Web Quản trị
/// (nguồn thật: API danh bạ, P3).
final List<GovContact> mockGovContacts = [
  // ── Lãnh đạo UBND xã ────────────────────────────────────────────────
  const GovContact(
    name: 'Nguyễn Văn Bình',
    title: 'Chủ tịch UBND xã',
    department: 'UBND xã',
    phone: '024 3378 2001',
    group: ContactGroup.leader,
  ),
  const GovContact(
    name: 'Trần Thị Hạnh',
    title: 'Phó Chủ tịch UBND xã',
    department: 'UBND xã',
    phone: '024 3378 2002',
    group: ContactGroup.leader,
  ),

  // ── Bộ phận chuyên môn ──────────────────────────────────────────────
  const GovContact(
    name: 'Trần Thị Hạnh',
    title: 'Phó Chủ tịch UBND xã · phụ trách',
    department: 'Văn phòng UBND',
    phone: '024 3378 4001',
    group: ContactGroup.department,
  ),
  const GovContact(
    name: 'Lê Minh Tuấn',
    title: 'Công chức Địa chính – Xây dựng',
    department: 'Địa chính – Xây dựng',
    phone: '024 3378 4002',
    group: ContactGroup.department,
  ),
  const GovContact(
    name: 'Phạm Thị Ngọc',
    title: 'Công chức Tư pháp – Hộ tịch',
    department: 'Tư pháp – Hộ tịch',
    phone: '024 3378 4003',
    group: ContactGroup.department,
  ),
  const GovContact(
    name: 'Vũ Đức Anh',
    title: 'Công chức Văn hoá – Xã hội',
    department: 'Văn hoá – Xã hội',
    phone: '024 3378 4004',
    group: ContactGroup.department,
  ),
  const GovContact(
    name: 'Đỗ Thanh Hà',
    title: 'Công chức Tài chính – Kế toán',
    department: 'Tài chính – Kế toán',
    phone: '024 3378 4005',
    group: ContactGroup.department,
  ),
  const GovContact(
    name: 'Ngô Thị Lan',
    title: 'Giám đốc Trung tâm',
    department: 'Trung tâm Phục vụ hành chính công',
    phone: '024 3378 4006',
    group: ContactGroup.department,
  ),
  const GovContact(
    name: 'Hoàng Văn Sơn',
    title: 'Trưởng Công an xã',
    department: 'Công an xã',
    phone: '024 3378 4007',
    group: ContactGroup.department,
  ),
  const GovContact(
    name: 'Bùi Quang Khải',
    title: 'Chỉ huy trưởng Quân sự xã',
    department: 'Quân sự xã',
    phone: '024 3378 4008',
    group: ContactGroup.department,
  ),
];
