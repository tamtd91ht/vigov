import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { StoredFile, StoredFileSchema } from '@vigov/shared';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { LocalStorageDriver } from './drivers/local.driver';
import { S3StorageDriver } from './drivers/s3.driver';

/** Dung lượng tối đa mặc định khi chưa cấu hình STORAGE_MAX_FILE_SIZE (20MB) */
const DEFAULT_MAX_FILE_SIZE = 20 * 1024 * 1024;

/**
 * Module lưu trữ tệp (WBS #24 — task P3-24).
 *
 * Multer dùng bộ nhớ tạm (memoryStorage) rồi chuyển buffer cho StorageDriver,
 * nhờ vậy đổi giữa local và S3 không phải sửa mã nghiệp vụ.
 * Export FilesService để Documents/Feedback/Content dùng lại.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: StoredFile.name, schema: StoredFileSchema }]),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: { fileSize: config.get<number>('storage.maxFileSize') ?? DEFAULT_MAX_FILE_SIZE },
      }),
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService, LocalStorageDriver, S3StorageDriver],
  exports: [FilesService],
})
export class FilesModule {}
