import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Dossier, DossierSchema } from '@vigov/shared';
import { DirectoryModule } from '../directory/directory.module';
import { DossiersController } from './dossiers.controller';
import { DossiersService } from './dossiers.service';

/**
 * Hồ sơ một cửa (WBS #15) — Phase 1 CHỈ tra cứu công khai theo mã.
 *
 * Không có endpoint tạo/sửa/xoá: WBS #15 chỉ yêu cầu tra cứu, và dữ liệu thật
 * phải đến từ hệ thống một cửa qua liên thông (hạng mục ngoài WBS). Xem
 * docs/01-BACKEND.md để biết nguồn dữ liệu hiện tại.
 */
@Module({
  imports: [
    DirectoryModule,MongooseModule.forFeature([{ name: Dossier.name, schema: DossierSchema }])],
  controllers: [DossiersController],
  providers: [DossiersService],
  exports: [DossiersService],
})
export class DossiersModule {}
