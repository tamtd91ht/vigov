import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Feedback,
  type FeedbackDocument,
  IncomingDocument,
  type IncomingDocumentDocument,
  Task,
  type TaskDocument,
} from '@vigov/shared';
import { GlobalSearchQueryDto } from './dto/search.dto';

/** Số kết quả mặc định mỗi loại */
const DEFAULT_LIMIT = 5;

/** Các loại dữ liệu được tìm ở Phase 1 */
const SEARCHABLE_TYPES = ['tasks', 'documents', 'feedback'] as const;
type SearchType = (typeof SEARCHABLE_TYPES)[number];

/** Điểm liên quan do MongoDB text search chấm — dùng để sắp xếp */
const TEXT_SCORE = { score: { $meta: 'textScore' } } as const;

/**
 * Tìm kiếm toàn cục (WBS #28, P3-28).
 *
 * Phase 1 dùng MongoDB `$text` trên các index đã khai báo sẵn ở libs/shared
 * (Task: title+description, IncomingDocument: summary+refNo+sender,
 * Feedback: title+description). Khi dữ liệu lớn hoặc cần gợi ý/gõ sai chính tả,
 * chuyển sang Elasticsearch mà không đổi hợp đồng API.
 *
 * Phạm vi tìm kiếm THẬT (có gồm hồ sơ công dân, hạng mục giải ngân, tin bài CMS
 * hay không) đang chờ khách xác nhận — câu hỏi mở #28. Tra cứu công dân hiện
 * cố tình để ngoài vì liên quan dữ liệu cá nhân (số điện thoại).
 */
@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(IncomingDocument.name) private readonly documentModel: Model<IncomingDocumentDocument>,
    @InjectModel(Feedback.name) private readonly feedbackModel: Model<FeedbackDocument>,
  ) {}

  async search(query: GlobalSearchQueryDto) {
    const keyword = query.q.trim();
    const limit = query.limit ?? DEFAULT_LIMIT;
    const types = this.parseTypes(query.types);
    const textFilter = { $text: { $search: keyword } };

    // Ba truy vấn độc lập → chạy song song để giảm độ trễ
    const [tasks, documents, feedback] = await Promise.all([
      types.includes('tasks')
        ? this.taskModel
            .find(textFilter, TEXT_SCORE)
            .sort(TEXT_SCORE)
            .limit(limit)
            .select('code title status department')
            .lean()
            .exec()
        : Promise.resolve([]),
      types.includes('documents')
        ? this.documentModel
            .find(textFilter, TEXT_SCORE)
            .sort(TEXT_SCORE)
            .limit(limit)
            .select('arrivalNo refNo summary department')
            .lean()
            .exec()
        : Promise.resolve([]),
      types.includes('feedback')
        ? this.feedbackModel
            .find(textFilter, TEXT_SCORE)
            .sort(TEXT_SCORE)
            .limit(limit)
            .select('code title status categoryKey')
            .lean()
            .exec()
        : Promise.resolve([]),
    ]);

    const results = {
      tasks: tasks.map((t) => ({
        code: t.code,
        title: t.title,
        status: t.status,
        department: t.department,
      })),
      documents: documents.map((d) => ({
        arrivalNo: d.arrivalNo,
        refNo: d.refNo,
        summary: d.summary,
        department: d.department,
      })),
      feedback: feedback.map((f) => ({
        code: f.code,
        title: f.title,
        status: f.status,
        categoryKey: f.categoryKey,
      })),
    };

    return {
      q: keyword,
      types,
      results,
      total: results.tasks.length + results.documents.length + results.feedback.length,
    };
  }

  /** Chuẩn hoá tham số `types`; bỏ trống nghĩa là tìm tất cả loại */
  private parseTypes(raw?: string): SearchType[] {
    if (!raw) return [...SEARCHABLE_TYPES];
    const wanted = raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t): t is SearchType => (SEARCHABLE_TYPES as readonly string[]).includes(t));
    return wanted.length > 0 ? wanted : [...SEARCHABLE_TYPES];
  }
}
