import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrgNode, OrgNodeSchema, StaffUser, StaffUserSchema } from '@vigov/shared';
import { DirectoryService } from './directory.service';

/**
 * Danh bạ tra cứu dùng chung (v2) — chỉ ĐỌC danh bạ cán bộ và cây tổ chức để
 * quy đổi id thành tên hiển thị.
 *
 * Mọi phân hệ nghiệp vụ nhập module này thay vì tự đọc `staff_users` /
 * `org_nodes`: một chỗ đọc nghĩa là một bộ đệm, một quy ước về tham chiếu không
 * tra được, và không phân hệ nào lỡ viết vòng lặp N+1.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StaffUser.name, schema: StaffUserSchema },
      { name: OrgNode.name, schema: OrgNodeSchema },
    ]),
  ],
  providers: [DirectoryService],
  exports: [DirectoryService],
})
export class DirectoryModule {}
