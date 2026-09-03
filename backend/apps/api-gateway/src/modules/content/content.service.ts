import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Article, type ArticleDocument, type JwtPayload } from '@vigov/shared';
import {
  RadioBulletin,
  type RadioBulletinDocument,
  Video,
  type VideoDocument,
} from './content.schema';
import {
  CreateArticleDto,
  CreateRadioDto,
  CreateVideoDto,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  ListArticleQueryDto,
  ListRadioQueryDto,
  ListVideoQueryDto,
  PublicArticleQueryDto,
  PaginationQueryDto,
  UpdateArticleDto,
  UpdateRadioDto,
  UpdateVideoDto,
} from './dto/content.dto';

/** Trạng thái nội dung dùng chung cho bài viết / video / bản tin */
const STATUS_DRAFT = 'draft';
const STATUS_PUBLISHED = 'published';

/** Số bản ghi tối đa trả về cho app công dân trong một lần gọi */
const PUBLIC_MAX_PAGE_SIZE = 50;

/**
 * Thứ tự hiển thị nội dung công khai: MỚI NHẤT LÊN ĐẦU.
 *
 * KHÔNG sắp theo `publishedAt`: trường đó là chuỗi hiển thị dạng
 * "DD/MM/YYYY HH:mm", nên MongoDB so sánh theo từng ký tự — "28/07/2026" đứng
 * trên "20/08/2026" vì '8' > '0'. Bài đăng hôm nay có ngày bắt đầu bằng "0"
 * rơi xuống gần cuối danh sách, cán bộ tưởng đăng hỏng.
 *
 * `updatedAt` do Mongoose tự quản (timestamps: true) và được cập nhật đúng lúc
 * bấm Đăng, nên phản ánh chính xác thứ tự phát hành.
 */
const PUBLIC_SORT = { updatedAt: -1, createdAt: -1 } as const;

@Injectable()
export class ContentService {
  constructor(
    @InjectModel(Article.name) private readonly articleModel: Model<ArticleDocument>,
    @InjectModel(Video.name) private readonly videoModel: Model<VideoDocument>,
    @InjectModel(RadioBulletin.name) private readonly radioModel: Model<RadioBulletinDocument>,
  ) {}

  // ----------------------------------------------------------------- Bài viết

  /** Danh sách bài viết cho Web Quản trị (thấy cả bản nháp) */
  async listArticles(query: ListArticleQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.q) filter.title = this.keywordRegex(query.q);

    return this.paginate(this.articleModel, filter, query, { createdAt: -1 });
  }

  /** Chi tiết bài viết trong Web Quản trị */
  async getArticle(id: string) {
    const article = await this.articleModel.findById(this.objectId(id)).lean().exec();
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');
    return article;
  }

  /** Tạo bài viết; tác giả lấy từ phiên đăng nhập của cán bộ */
  async createArticle(dto: CreateArticleDto, user?: JwtPayload) {
    const status = dto.status ?? STATUS_DRAFT;
    const created = await this.articleModel.create({
      ...dto,
      status,
      author: user?.displayName ?? '',
      publishedAt: status === STATUS_PUBLISHED ? this.nowLabel() : '',
    });
    return created.toObject();
  }

  /** Cập nhật nội dung bài viết (không đổi trạng thái phát hành) */
  async updateArticle(id: string, dto: UpdateArticleDto) {
    const updated = await this.articleModel
      .findByIdAndUpdate(this.objectId(id), { $set: { ...dto } }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy bài viết');
    return updated;
  }

  /** Xoá bài viết — chỉ quản trị hệ thống */
  async removeArticle(id: string) {
    const removed = await this.articleModel.findByIdAndDelete(this.objectId(id)).lean().exec();
    if (!removed) throw new NotFoundException('Không tìm thấy bài viết');
    return { deleted: true, id };
  }

  /**
   * Phát hành / thu hồi bài viết.
   * Phase 1 chỉ đổi trạng thái trực tiếp — quy trình biên tập (ai soạn, ai duyệt,
   * có cần lãnh đạo ký duyệt trước khi lên app không) chờ khách chốt (câu hỏi mở #14).
   */
  async publishArticle(id: string, status?: string) {
    const nextStatus = status ?? STATUS_PUBLISHED;
    const updated = await this.articleModel
      .findByIdAndUpdate(
        this.objectId(id),
        {
          $set: {
            status: nextStatus,
            publishedAt: nextStatus === STATUS_PUBLISHED ? this.nowLabel() : '',
          },
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy bài viết');
    return updated;
  }

  // -------------------------------------------------------------------- Video

  /** Danh sách video cho Web Quản trị */
  async listVideos(query: ListVideoQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.topic) filter.topic = query.topic;
    if (query.status) filter.status = query.status;
    if (query.q) filter.title = this.keywordRegex(query.q);

    return this.paginate(this.videoModel, filter, query, { createdAt: -1 });
  }

  /** Chi tiết video */
  async getVideo(id: string) {
    const video = await this.videoModel.findById(this.objectId(id)).lean().exec();
    if (!video) throw new NotFoundException('Không tìm thấy video');
    return video;
  }

  /** Tạo video tuyên truyền */
  async createVideo(dto: CreateVideoDto) {
    const status = dto.status ?? STATUS_DRAFT;
    const created = await this.videoModel.create({
      ...dto,
      status,
      publishedAt: status === STATUS_PUBLISHED ? this.nowLabel() : '',
    });
    return created.toObject();
  }

  /** Cập nhật video; đặt mốc phát hành khi chuyển sang published */
  async updateVideo(id: string, dto: UpdateVideoDto) {
    const patch: Record<string, unknown> = { ...dto };
    if (dto.status === STATUS_PUBLISHED) patch.publishedAt = this.nowLabel();

    const updated = await this.videoModel
      .findByIdAndUpdate(this.objectId(id), { $set: patch }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy video');
    return updated;
  }

  /** Xoá video */
  async removeVideo(id: string) {
    const removed = await this.videoModel.findByIdAndDelete(this.objectId(id)).lean().exec();
    if (!removed) throw new NotFoundException('Không tìm thấy video');
    return { deleted: true, id };
  }

  // ------------------------------------------------------------ Truyền thanh

  /** Danh sách bản tin truyền thanh cho Web Quản trị */
  async listRadio(query: ListRadioQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.category) filter.category = query.category;
    if (query.status) filter.status = query.status;
    if (query.q) filter.title = this.keywordRegex(query.q);

    return this.paginate(this.radioModel, filter, query, { createdAt: -1 });
  }

  /** Tạo bản tin truyền thanh */
  async createRadio(dto: CreateRadioDto) {
    const created = await this.radioModel.create({ ...dto, status: dto.status ?? STATUS_DRAFT });
    return created.toObject();
  }

  /** Cập nhật bản tin truyền thanh */
  async updateRadio(id: string, dto: UpdateRadioDto) {
    const updated = await this.radioModel
      .findByIdAndUpdate(this.objectId(id), { $set: { ...dto } }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy bản tin truyền thanh');
    return updated;
  }

  /** Xoá bản tin truyền thanh */
  async removeRadio(id: string) {
    const removed = await this.radioModel.findByIdAndDelete(this.objectId(id)).lean().exec();
    if (!removed) throw new NotFoundException('Không tìm thấy bản tin truyền thanh');
    return { deleted: true, id };
  }

  // ------------------------------------------- Nội dung công khai cho công dân

  /** Bài viết đã phát hành — app Flutter / Zalo Mini App */
  async publicArticles(query: PublicArticleQueryDto) {
    const filter: Record<string, unknown> = { status: STATUS_PUBLISHED };
    if (query.type) filter.type = query.type;

    return this.paginate(
      this.articleModel,
      filter,
      this.clampPublic(query),
      PUBLIC_SORT,
      '-content',
    );
  }

  /** Chi tiết bài viết công khai — mỗi lượt mở tăng bộ đếm lượt xem */
  async publicArticleDetail(id: string) {
    const article = await this.articleModel
      .findOneAndUpdate(
        { _id: this.objectId(id), status: STATUS_PUBLISHED },
        { $inc: { views: 1 } },
        { new: true },
      )
      .lean()
      .exec();
    if (!article) throw new NotFoundException('Không tìm thấy bài viết');
    return article;
  }

  /** Video đã phát hành cho app công dân */
  async publicVideos(query: PaginationQueryDto) {
    return this.paginate(
      this.videoModel,
      { status: STATUS_PUBLISHED },
      this.clampPublic(query),
      PUBLIC_SORT,
    );
  }

  /** Bản tin truyền thanh đã phát hành cho app công dân */
  async publicRadio(query: PaginationQueryDto) {
    return this.paginate(
      this.radioModel,
      { status: STATUS_PUBLISHED },
      this.clampPublic(query),
      { createdAt: -1 },
    );
  }

  // ------------------------------------------------------------------ Tiện ích

  /**
   * Phân trang dùng chung: trả items + meta để FE dựng thanh phân trang.
   * Tham số model để kiểu lỏng vì 3 collection có kiểu document khác nhau,
   * ràng buộc generic của Mongoose không gộp được trong một chữ ký.
   */
  private async paginate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: Model<any>,
    filter: Record<string, unknown>,
    query: PaginationQueryDto,
    sort: Record<string, 1 | -1>,
    projection?: string,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const [items, total] = await Promise.all([
      model
        .find(filter, projection)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      model.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** Giới hạn số bản ghi endpoint công khai để tránh tải nặng từ app */
  private clampPublic(query: PaginationQueryDto): PaginationQueryDto {
    return {
      page: query.page ?? DEFAULT_PAGE,
      limit: Math.min(query.limit ?? DEFAULT_PAGE_SIZE, PUBLIC_MAX_PAGE_SIZE),
    };
  }

  /** Tìm gần đúng theo từ khoá, không phân biệt hoa thường */
  private keywordRegex(keyword: string): RegExp {
    return new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  /** Kiểm tra id hợp lệ trước khi truy vấn để trả lỗi tiếng Việt thay vì CastError */
  private objectId(id: string): string {
    if (!isValidObjectId(id)) throw new BadRequestException('Mã nội dung không hợp lệ');
    return id;
  }

  /** Mốc phát hành hiển thị: "27/08/2026 14:05" */
  private nowLabel(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
}
