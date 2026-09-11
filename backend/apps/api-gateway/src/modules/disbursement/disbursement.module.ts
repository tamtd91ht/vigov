import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BudgetItem, BudgetItemSchema } from '@vigov/shared';
import { AuditModule } from '../audit/audit.module';
import { DisbursementController } from './disbursement.controller';
import { DisbursementService } from './disbursement.service';

/** Ngân sách – Giải ngân (WBS #5): hạng mục, lần giải ngân, vướng mắc, đề nghị duyệt */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: BudgetItem.name, schema: BudgetItemSchema }]),
    // Xuất Excel là GET nên AuditInterceptor không bắt — phải tự ghi vết
    AuditModule,
  ],
  controllers: [DisbursementController],
  providers: [DisbursementService],
  exports: [DisbursementService],
})
export class DisbursementModule {}
