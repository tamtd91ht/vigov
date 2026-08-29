import { Controller, Get } from '@nestjs/common';
import { Public, RequirePermission } from '@vigov/shared';
import { CatalogsService } from './catalogs.service';

/**
 * Danh mục dùng chung (WBS #9) — nguồn dữ liệu cho các dropdown / bộ lọc của
 * Web Quản trị. Chỉ đọc, và ai đăng nhập cũng cần nên gác ở mức overview:view.
 */
@Controller('catalogs')
@RequirePermission('overview', 'view')
export class CatalogsController {
  constructor(private readonly catalogs: CatalogsService) {}

  /** Bộ phận chuyên môn (cây tổ chức, lùi về tài khoản cán bộ) */
  @Get('departments')
  departments() {
    return this.catalogs.departments();
  }

  /** Danh bạ cán bộ cho dropdown phân công */
  @Get('staff')
  staff() {
    return this.catalogs.staff();
  }

  /** Thôn / tổ dân phố */
  @Get('areas')
  areas() {
    return this.catalogs.areas();
  }

  /** Chuyên mục bài viết CMS */
  @Get('article-categories')
  articleCategories() {
    return this.catalogs.articleCategories();
  }

  /** Chủ đề video tuyên truyền */
  /**
   * Danh bạ chính quyền cho app công dân và Zalo Mini App.
   * @Public vì công dân tra danh bạ trước cả khi định danh; dữ liệu là số máy
   * công vụ đã công bố, không phải thông tin cá nhân.
   * Khai trước các route khác để 'public' không bị tham số đường dẫn bắt nhầm.
   */
  @Public()
  @Get('public/directory')
  publicDirectory() {
    return this.catalogs.publicDirectory();
  }

  @Get('document-types')
  documentTypes() {
    return this.catalogs.documentTypes();
  }

  @Get('video-topics')
  videoTopics() {
    return this.catalogs.videoTopics();
  }

  /** Chuyên mục bản tin truyền thanh */
  @Get('radio-categories')
  radioCategories() {
    return this.catalogs.radioCategories();
  }

  /** Năm ngân sách có dữ liệu */
  @Get('budget-years')
  budgetYears() {
    return this.catalogs.budgetYears();
  }
}
