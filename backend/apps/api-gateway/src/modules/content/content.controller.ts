import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Public, RequirePermission, type AuthedRequest } from '@vigov/shared';
import { ContentService } from './content.service';
import {
  CreateArticleDto,
  CreateRadioDto,
  CreateVideoDto,
  ListArticleQueryDto,
  ListRadioQueryDto,
  ListVideoQueryDto,
  PaginationQueryDto,
  PublicArticleQueryDto,
  PublishArticleDto,
  UpdateArticleDto,
  UpdateRadioDto,
  UpdateVideoDto,
} from './dto/content.dto';

/**
 * CMS nội dung (WBS #10) — soạn bài viết, video, bản tin truyền thanh
 * và đẩy sang app Flutter / Zalo Mini App qua nhóm endpoint /public.
 */
@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  // ------------------------------------------- Nội dung công khai cho công dân
  // Khai báo trước nhóm quản trị để route /public/... không bị :id bắt nhầm.

  /** Bài viết đã phát hành cho app công dân */
  @Public()
  @Get('public/articles')
  publicArticles(@Query() query: PublicArticleQueryDto) {
    return this.content.publicArticles(query);
  }

  /** Chi tiết bài viết công khai — tăng lượt xem mỗi lần mở */
  @Public()
  @Get('public/articles/:id')
  publicArticleDetail(@Param('id') id: string) {
    return this.content.publicArticleDetail(id);
  }

  /** Video đã phát hành cho app công dân */
  @Public()
  @Get('public/videos')
  publicVideos(@Query() query: PaginationQueryDto) {
    return this.content.publicVideos(query);
  }

  /** Bản tin truyền thanh đã phát hành cho app công dân */
  @Public()
  @Get('public/radio')
  publicRadio(@Query() query: PaginationQueryDto) {
    return this.content.publicRadio(query);
  }

  // ----------------------------------------------------------------- Bài viết

  /** Danh sách bài viết (gồm cả bản nháp) cho Web Quản trị */
  @Get('articles')
  @RequirePermission('cms', 'view')
  listArticles(@Query() query: ListArticleQueryDto) {
    return this.content.listArticles(query);
  }

  /** Chi tiết bài viết */
  @Get('articles/:id')
  @RequirePermission('cms', 'view')
  getArticle(@Param('id') id: string) {
    return this.content.getArticle(id);
  }

  /** Tạo bài viết mới */
  @Post('articles')
  @RequirePermission('cms', 'edit')
  createArticle(@Body() dto: CreateArticleDto, @Req() req: AuthedRequest) {
    return this.content.createArticle(dto, req.user);
  }

  /** Cập nhật nội dung bài viết */
  @Patch('articles/:id')
  @RequirePermission('cms', 'edit')
  updateArticle(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.content.updateArticle(id, dto);
  }

  /**
   * Phát hành / thu hồi bài viết.
   * Quy trình biên tập (ai đăng, ai duyệt trước khi lên app) chờ khách chốt
   * (câu hỏi mở #14) — Phase 1 cho phép người có quyền cms:edit tự phát hành.
   */
  @Patch('articles/:id/publish')
  @RequirePermission('cms', 'edit')
  publishArticle(@Param('id') id: string, @Body() dto: PublishArticleDto) {
    return this.content.publishArticle(id, dto.status);
  }

  /** Xoá bài viết — chỉ quản trị hệ thống */
  @Delete('articles/:id')
  @RequirePermission('cms', 'admin')
  removeArticle(@Param('id') id: string) {
    return this.content.removeArticle(id);
  }

  // -------------------------------------------------------------------- Video

  /** Danh sách video tuyên truyền */
  @Get('videos')
  @RequirePermission('cms', 'view')
  listVideos(@Query() query: ListVideoQueryDto) {
    return this.content.listVideos(query);
  }

  /** Chi tiết video */
  @Get('videos/:id')
  @RequirePermission('cms', 'view')
  getVideo(@Param('id') id: string) {
    return this.content.getVideo(id);
  }

  /** Thêm video mới */
  @Post('videos')
  @RequirePermission('cms', 'edit')
  createVideo(@Body() dto: CreateVideoDto) {
    return this.content.createVideo(dto);
  }

  /** Cập nhật video */
  @Patch('videos/:id')
  @RequirePermission('cms', 'edit')
  updateVideo(@Param('id') id: string, @Body() dto: UpdateVideoDto) {
    return this.content.updateVideo(id, dto);
  }

  /** Xoá video */
  @Delete('videos/:id')
  @RequirePermission('cms', 'edit')
  removeVideo(@Param('id') id: string) {
    return this.content.removeVideo(id);
  }

  // ------------------------------------------------------------ Truyền thanh

  /** Danh sách bản tin truyền thanh */
  @Get('radio')
  @RequirePermission('cms', 'view')
  listRadio(@Query() query: ListRadioQueryDto) {
    return this.content.listRadio(query);
  }

  /** Thêm bản tin truyền thanh */
  @Post('radio')
  @RequirePermission('cms', 'edit')
  createRadio(@Body() dto: CreateRadioDto) {
    return this.content.createRadio(dto);
  }

  /** Cập nhật bản tin truyền thanh */
  @Patch('radio/:id')
  @RequirePermission('cms', 'edit')
  updateRadio(@Param('id') id: string, @Body() dto: UpdateRadioDto) {
    return this.content.updateRadio(id, dto);
  }

  /** Xoá bản tin truyền thanh */
  @Delete('radio/:id')
  @RequirePermission('cms', 'edit')
  removeRadio(@Param('id') id: string) {
    return this.content.removeRadio(id);
  }
}
