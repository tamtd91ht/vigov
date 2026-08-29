import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BudgetItem, BudgetItemSchema } from '@vigov/shared';
import { DisbursementController } from './disbursement.controller';
import { DisbursementService } from './disbursement.service';

/** Ngân sách – Giải ngân (WBS #5): hạng mục, lần giải ngân, vướng mắc, đề nghị duyệt */
@Module({
  imports: [MongooseModule.forFeature([{ name: BudgetItem.name, schema: BudgetItemSchema }])],
  controllers: [DisbursementController],
  providers: [DisbursementService],
  exports: [DisbursementService],
})
export class DisbursementModule {}
