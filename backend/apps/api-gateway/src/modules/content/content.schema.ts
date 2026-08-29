import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Schema cục bộ của phân hệ CMS (WBS #10).
 * Chỉ module Content dùng nên khai báo tại chỗ, KHÔNG đưa vào @vigov/shared —
 * khi có phân hệ khác cần dùng chung mới cân nhắc chuyển ra libs.
 */

export type VideoDocument = HydratedDocument<Video>;
export type RadioBulletinDocument = HydratedDocument<RadioBulletin>;

/** Video tuyên truyền đẩy sang app Flutter / Zalo Mini App */
@Schema({ collection: 'videos', timestamps: true })
export class Video {
  @Prop({ required: true })
  title: string;

  /** Chuyên mục: an ninh trật tự, nông nghiệp, chuyển đổi số… */
  @Prop({ default: '', index: true })
  topic: string;

  /** Thời lượng hiển thị, ví dụ "05:12" */
  @Prop({ default: '' })
  duration: string;

  @Prop({ default: 0 })
  views: number;

  /** Nguồn phát: nhúng YouTube hay tệp tự lưu trữ */
  @Prop({ enum: ['youtube', 'hosted'], default: 'youtube', index: true })
  source: string;

  /** Id tệp video trong file storage khi source = 'hosted' (P3-24) */
  @Prop()
  videoFileId?: string;

  /** Đường dẫn YouTube khi source = 'youtube' */
  @Prop()
  youtubeUrl?: string;

  @Prop({ default: 'var(--blue)' })
  coverColor: string;

  @Prop({ default: '' })
  publishedAt: string;

  @Prop({ enum: ['draft', 'published'], default: 'draft', index: true })
  status: string;
}
export const VideoSchema = SchemaFactory.createForClass(Video);
VideoSchema.index({ title: 'text', topic: 'text' });

/** Bản tin truyền thanh xã (audio) */
@Schema({ collection: 'radio_bulletins', timestamps: true })
export class RadioBulletin {
  @Prop({ required: true })
  title: string;

  @Prop({ default: '', index: true })
  category: string;

  /** Ngày phát dạng hiển thị dd/MM/yyyy */
  @Prop({ default: '' })
  date: string;

  @Prop({ default: 0 })
  durationSeconds: number;

  @Prop({ default: 0 })
  plays: number;

  /** Id tệp audio trong file storage (P3-24) */
  @Prop()
  audioFileId?: string;

  @Prop({ enum: ['draft', 'published'], default: 'draft', index: true })
  status: string;
}
export const RadioBulletinSchema = SchemaFactory.createForClass(RadioBulletin);
RadioBulletinSchema.index({ title: 'text', category: 'text' });
