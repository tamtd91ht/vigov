import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import {
  CitizenUser,
  type CitizenUserDocument,
  LoginSession,
  type LoginSessionDocument,
  SessionRegistry,
  StaffUser,
  type StaffUserDocument,
  type SessionState,
} from '@vigov/shared';

/**
 * Nối SessionRegistry (nằm ở libs/shared, không biết gì về cơ sở dữ liệu)
 * với dữ liệu thật trong MongoDB.
 *
 * Tách riêng để libs/shared không phải phụ thuộc vào Mongoose.
 */
@Injectable()
export class SessionRegistryProvider implements OnModuleInit {
  private readonly logger = new Logger(SessionRegistryProvider.name);

  constructor(
    private readonly registry: SessionRegistry,
    @InjectModel(LoginSession.name) private readonly sessionModel: Model<LoginSessionDocument>,
    @InjectModel(StaffUser.name) private readonly staffModel: Model<StaffUserDocument>,
    @InjectModel(CitizenUser.name) private readonly citizenModel: Model<CitizenUserDocument>,
  ) {}

  onModuleInit(): void {
    this.registry.registerResolver((sessionId) => this.resolve(sessionId));
    this.logger.log('Đã đăng ký nguồn tra cứu phiên đăng nhập cho JwtAuthGuard');
  }

  private async resolve(sessionId: string): Promise<SessionState | null> {
    if (!isValidObjectId(sessionId)) return null;

    const session = await this.sessionModel.findById(sessionId).lean().exec();
    if (!session) return null;
    if (session.revoked) return { revoked: true, subjectLocked: false };

    // Chủ tài khoản bị khoá thì token cũng phải mất hiệu lực ngay
    const locked =
      session.kind === 'web'
        ? await this.isStaffLocked(session.subject)
        : await this.isCitizenLocked(session.subject);

    return { revoked: false, subjectLocked: locked };
  }

  private async isStaffLocked(username: string): Promise<boolean> {
    const staff = await this.staffModel.findOne({ username }).select('status').lean().exec();
    // Tài khoản đã bị xoá cũng coi như không dùng được nữa
    return !staff || staff.status === 'locked';
  }

  private async isCitizenLocked(phone: string): Promise<boolean> {
    const citizen = await this.citizenModel.findOne({ phone }).select('status').lean().exec();
    return !!citizen && citizen.status === 'locked';
  }
}
