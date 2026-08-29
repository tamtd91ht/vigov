import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Schema cục bộ của phân hệ Bản đồ kinh tế số (WBS #7).
 * Chỉ module Map dùng nên khai báo tại chỗ, KHÔNG đưa vào @vigov/shared —
 * khi có phân hệ khác cần dùng chung mới cân nhắc chuyển ra libs.
 *
 * Tên trường thống nhất với admin-web/src/types/index.ts (MapLayer, MapPin):
 * FE ánh xạ `key` → `id` và `layerKey` → `layerId` ở tầng service.
 */

export type MapLayerDocument = HydratedDocument<MapLayer>;
export type MapPinDocument = HydratedDocument<MapPin>;

/** Một lớp dữ liệu bật/tắt trên bản đồ (doanh nghiệp, hộ kinh doanh, chợ…) */
@Schema({ collection: 'map_layers', timestamps: true })
export class MapLayer {
  /** Khoá tự nhiên, ví dụ 'dn', 'hkd' — dùng nối ghim với lớp */
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop({ required: true })
  label: string;

  /** Màu nhận diện ghim & chấm trong panel lớp dữ liệu */
  @Prop({ default: 'var(--blue)' })
  color: string;

  /** Lớp có bật sẵn khi mở trang bản đồ hay không */
  @Prop({ default: true })
  defaultOn: boolean;

  /** Thứ tự hiển thị trong panel lớp dữ liệu */
  @Prop({ default: 0 })
  order: number;
}
export const MapLayerSchema = SchemaFactory.createForClass(MapLayer);

/** Một ghim cơ sở kinh tế / hạ tầng trên bản đồ */
@Schema({ collection: 'map_pins', timestamps: true })
export class MapPin {
  /** Khoá lớp dữ liệu (MapLayer.key) */
  @Prop({ required: true, index: true })
  layerKey: string;

  @Prop({ required: true, index: true })
  name: string;

  /** Ngành nghề / mô tả chức năng của cơ sở */
  @Prop({ default: '' })
  industry: string;

  @Prop({ default: '' })
  address: string;

  /** Số lao động; 0 với công trình chưa vận hành */
  @Prop({ default: 0 })
  workers: number;

  @Prop({ default: '' })
  representative: string;

  @Prop({ default: '' })
  phone: string;

  /** Toạ độ % trong khung bản đồ mô phỏng (adapter "mock" của admin-web) */
  @Prop({ default: 0 })
  x: number;

  @Prop({ default: 0 })
  y: number;

  /**
   * Toạ độ địa lý thật — để dành cho adapter bản đồ thật
   * (câu hỏi mở #2: VietMap / Goong / MapLibre chờ khách chốt).
   */
  @Prop()
  lat?: number;

  @Prop()
  lng?: number;
}
export const MapPinSchema = SchemaFactory.createForClass(MapPin);
MapPinSchema.index({ name: 'text', industry: 'text', address: 'text' });
