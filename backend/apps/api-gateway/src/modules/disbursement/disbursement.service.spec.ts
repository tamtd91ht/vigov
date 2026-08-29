import { BadRequestException } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { BudgetItemDocument } from '@vigov/shared';
import { DisbursementService } from './disbursement.service';

/**
 * parseAmountToTyDong là điểm dễ sai nhất của phân hệ Giải ngân: kế toán gõ số
 * tiền tự do ("1,25 tỷ", "350.000.000 đồng") và kết quả cộng thẳng vào luỹ kế
 * giải ngân. Sai hệ số một bậc là lệch báo cáo 1000 lần.
 */
describe('DisbursementService.parseAmountToTyDong', () => {
  const service = new DisbursementService({} as unknown as Model<BudgetItemDocument>);
  const parse = (raw: string) => service.parseAmountToTyDong(raw);

  describe('các ví dụ trong đặc tả', () => {
    it.each<[string, number]>([
      ['1,25 tỷ', 1.25],
      ['800 triệu', 0.8],
      ['1.200 triệu', 1.2],
      ['350.000.000 đồng', 0.35],
      ['15 tr', 0.015],
    ])('"%s" → %p tỷ', (input, expected) => {
      expect(parse(input)).toBeCloseTo(expected, 9);
    });
  });

  describe('đơn vị tỷ (mặc định)', () => {
    it.each<[string, number]>([
      ['2 tỷ', 2],
      ['2 ty', 2],
      ['0,5', 0.5],
      ['0.5', 0.5],
      ['12', 12],
      ['1,25 tỷ đồng', 1.25],
      ['  3,75 Tỷ  ', 3.75],
    ])('"%s" → %p tỷ', (input, expected) => {
      expect(parse(input)).toBeCloseTo(expected, 9);
    });
  });

  describe('đơn vị triệu', () => {
    it.each<[string, number]>([
      ['500 triệu', 0.5],
      ['500 trieu', 0.5],
      ['1.500 triệu', 1.5],
      ['2,5 triệu', 0.0025],
      ['100 tr', 0.1],
    ])('"%s" → %p tỷ', (input, expected) => {
      expect(parse(input)).toBeCloseTo(expected, 9);
    });
  });

  describe('đơn vị nghìn và đồng', () => {
    it.each<[string, number]>([
      ['500 nghìn', 0.0005],
      ['500 nghin', 0.0005],
      ['500 ngàn', 0.0005],
      ['1.000.000 đồng', 0.001],
      ['1.500.000.000 đồng', 1.5],
      ['250000000 vnd', 0.25],
    ])('"%s" → %p tỷ', (input, expected) => {
      expect(parse(input)).toBeCloseTo(expected, 9);
    });
  });

  describe('quy tắc dấu chấm / dấu phẩy', () => {
    it('dấu chấm đứng trước đúng 3 chữ số là phân cách nghìn', () => {
      expect(parse('1.200 triệu')).toBeCloseTo(1.2, 9);
    });

    it('dấu chấm đứng trước ÍT hơn 3 chữ số là dấu thập phân', () => {
      expect(parse('1.5 tỷ')).toBeCloseTo(1.5, 9);
      expect(parse('1.25 tỷ')).toBeCloseTo(1.25, 9);
    });

    it('dấu phẩy luôn là dấu thập phân', () => {
      expect(parse('1,2 tỷ')).toBeCloseTo(1.2, 9);
    });

    it('nhiều dấu chấm phân cách nghìn đều bị loại bỏ', () => {
      expect(parse('12.345.678.900 đồng')).toBeCloseTo(12.3456789, 9);
    });
  });

  describe('đầu vào không hợp lệ', () => {
    it.each(['', '   ', 'không rõ', 'tỷ đồng', 'abc'])('"%s" bị từ chối', (input) => {
      expect(() => parse(input)).toThrow(BadRequestException);
    });

    it('null / undefined bị từ chối', () => {
      expect(() => parse(null as unknown as string)).toThrow(BadRequestException);
      expect(() => parse(undefined as unknown as string)).toThrow(BadRequestException);
    });
  });

  describe('tính chất chung', () => {
    it('cùng một số tiền viết bằng đơn vị khác nhau cho cùng kết quả', () => {
      const byTy = parse('1,5 tỷ');
      expect(parse('1.500 triệu')).toBeCloseTo(byTy, 9);
      expect(parse('1.500.000.000 đồng')).toBeCloseTo(byTy, 9);
    });

    it('thang đơn vị giảm dần: tỷ > triệu > nghìn > đồng', () => {
      expect(parse('1 tỷ')).toBeGreaterThan(parse('1 triệu'));
      expect(parse('1 triệu')).toBeGreaterThan(parse('1 nghìn'));
      expect(parse('1 nghìn')).toBeGreaterThan(parse('1 đồng'));
    });
  });
});
