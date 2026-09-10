import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import { encryptSecret } from '@vigov/shared';
import { queryChain } from '../../../../../test/support/mongoose-mock';
import { IntegrationSettingsService } from './integration-settings.service';
import type { IntegrationSettings } from './schemas/integration-settings.schema';

/**
 * Kiểm thử cấu hình nhà cung cấp bên thứ 3.
 *
 * Hai thứ phải khoá lại:
 *  1. THỨ TỰ ƯU TIÊN một chiều — cơ sở dữ liệu thắng biến môi trường, biến môi
 *     trường chỉ là giá trị mồi. Sai chiều là dùng khoá của nguồn khác mà không
 *     ai biết.
 *  2. KHOÁ API KHÔNG BAO GIỜ RA API dạng rõ — chỉ dạng đã che.
 *
 * Mọi khoá dưới đây là khoá GIẢ.
 */

const GOC = 'bi-mat-goc-gia-de-test-toi-thieu-32-ky-tu';
const KHOA_DB = 'KEY-TU-CO-SO-DU-LIEU-9999';
const KHOA_ENV = 'KEY-TU-BIEN-MOI-TRUONG-1111';

function dungService(opts: {
  /** Bản ghi cấu hình trong cơ sở dữ liệu; null là chưa có bản ghi nào */
  banGhi?: Record<string, unknown> | null;
  /** Giá trị biến môi trường */
  env?: { provider?: string; apiKey?: string; endpoint?: string };
} = {}) {
  const banGhi = opts.banGhi === undefined ? null : opts.banGhi;
  const env = opts.env ?? {};

  // Khai jest.Mock tường minh: nếu để suy diễn, TypeScript coi mock là hàm
  // không tham số nên đọc mock.calls[0][1] bị báo lỗi kiểu
  const updateOne: jest.Mock = jest.fn(() => queryChain({ acknowledged: true }));
  const model = {
    findOne: jest.fn(() => queryChain(banGhi)),
    updateOne,
  } as unknown as Model<IntegrationSettings>;

  const cauHinh: Record<string, string> = {
    'auth.jwtSecret': GOC,
    'ocr.provider': env.provider ?? '',
    'ocr.apiKey': env.apiKey ?? '',
    'ocr.endpoint': env.endpoint ?? '',
  };
  const config = { get: (key: string) => cauHinh[key] } as unknown as ConfigService;

  return { service: new IntegrationSettingsService(model, config), updateOne };
}

describe('IntegrationSettingsService — thứ tự ưu tiên cấu hình', () => {
  it('chưa có bản ghi nào thì dùng biến môi trường', async () => {
    const { service } = dungService({
      banGhi: null,
      env: { provider: 'ocrspace', apiKey: KHOA_ENV, endpoint: 'https://vi-du.test/ocr' },
    });

    const kq = await service.resolveOcr();

    expect(kq).toEqual({
      provider: 'ocrspace',
      apiKey: KHOA_ENV,
      endpoint: 'https://vi-du.test/ocr',
      source: 'env',
    });
  });

  it('có cấu hình trong cơ sở dữ liệu thì CSDL thắng biến môi trường', async () => {
    const { service } = dungService({
      banGhi: {
        ocr: {
          provider: 'ocrspace',
          apiKeyEncrypted: encryptSecret(KHOA_DB, GOC),
          endpoint: '',
        },
      },
      env: { provider: 'mock', apiKey: KHOA_ENV, endpoint: 'https://khong-dung.test' },
    });

    const kq = await service.resolveOcr();

    expect(kq.source).toBe('database');
    expect(kq.provider).toBe('ocrspace');
    expect(kq.apiKey).toBe(KHOA_DB);
    // Điểm cuối để trống trong CSDL thì là trống, KHÔNG lấy lẫn của env:
    // trộn hai nguồn trong một lần giải quyết là cấu hình không truy được
    expect(kq.endpoint).toBe('');
  });

  it('provider rỗng trong CSDL là cách chủ động quay về biến môi trường', async () => {
    const { service } = dungService({
      banGhi: { ocr: { provider: '', apiKeyEncrypted: '', endpoint: '' } },
      env: { provider: 'mock', apiKey: KHOA_ENV },
    });

    const kq = await service.resolveOcr();

    expect(kq.source).toBe('env');
    expect(kq.provider).toBe('mock');
  });

  it('khoá đã lưu không giải mã được thì coi như chưa có khoá, KHÔNG ném lỗi', async () => {
    // Đổi JWT_SECRET là mọi khoá cũ không đọc được. Ném lỗi ở đây là cả trang
    // Cấu hình không mở được — cán bộ mất luôn đường vào để nhập lại khoá.
    const { service } = dungService({
      banGhi: {
        ocr: {
          provider: 'ocrspace',
          apiKeyEncrypted: encryptSecret(KHOA_DB, 'mot-bi-mat-goc-khac-hoan-toan-32-ky'),
          endpoint: '',
        },
      },
    });

    const kq = await service.resolveOcr();

    expect(kq.provider).toBe('ocrspace');
    expect(kq.apiKey).toBe('');
  });
});

describe('IntegrationSettingsService — không lộ khoá ra API', () => {
  it('trạng thái trả ra chỉ có khoá ĐÃ CHE, không có khoá rõ và không có bản mã hoá', async () => {
    const daMaHoa = encryptSecret(KHOA_DB, GOC);
    const { service } = dungService({
      banGhi: {
        ocr: { provider: 'ocrspace', apiKeyEncrypted: daMaHoa, endpoint: '' },
        updatedBy: 'canbo.a',
        updatedAt: new Date('2026-09-10T10:00:00Z'),
      },
    });

    const tt = await service.getOcrStatus();
    const json = JSON.stringify(tt);

    expect(tt.apiKeyMasked).toBe('••••••••9999');
    expect(tt.hasStoredKey).toBe(true);
    expect(tt.storedKeyUnreadable).toBe(false);
    expect(tt.updatedBy).toBe('canbo.a');
    // Không rò rỉ theo bất kỳ đường nào
    expect(json).not.toContain(KHOA_DB);
    expect(json).not.toContain(daMaHoa);
  });

  it('báo rõ khi khoá đã lưu không đọc được, để cán bộ biết phải nhập lại', async () => {
    const { service } = dungService({
      banGhi: {
        ocr: {
          provider: 'ocrspace',
          apiKeyEncrypted: encryptSecret(KHOA_DB, 'mot-bi-mat-goc-khac-hoan-toan-32-ky'),
          endpoint: '',
        },
      },
    });

    const tt = await service.getOcrStatus();

    expect(tt.hasStoredKey).toBe(true);
    expect(tt.storedKeyUnreadable).toBe(true);
    expect(tt.apiKeyMasked).toBe('');
  });

  it('chưa có khoá thì khoá che là rỗng, không phải dấu che gây tưởng đã có', async () => {
    const { service } = dungService({ banGhi: null, env: { provider: 'mock' } });

    const tt = await service.getOcrStatus();

    expect(tt.apiKeyMasked).toBe('');
    expect(tt.hasStoredKey).toBe(false);
  });
});

describe('IntegrationSettingsService — lưu cấu hình', () => {
  it('mã hoá khoá trước khi ghi, KHÔNG ghi dạng rõ', async () => {
    const { service, updateOne } = dungService({ banGhi: null });

    await service.updateOcr({ provider: 'ocrspace', apiKey: KHOA_DB }, 'canbo.a');

    const $set = updateOne.mock.calls[0][1].$set as Record<string, string>;
    expect($set['ocr.apiKeyEncrypted']).not.toContain(KHOA_DB);
    expect($set['ocr.apiKeyEncrypted']).toMatch(/^v1:/);
    expect($set.updatedBy).toBe('canbo.a');
  });

  it('KHÔNG gửi apiKey là giữ khoá đang lưu — không vô tình xoá', async () => {
    // Giao diện không bao giờ nhận lại khoá rõ nên không thể gửi lại khoá cũ để
    // "giữ nguyên"; phải phân biệt bỏ qua trường và gửi chuỗi rỗng.
    const { service, updateOne } = dungService({ banGhi: null });

    await service.updateOcr({ endpoint: 'https://vi-du.test/ocr' }, 'canbo.a');

    const $set = updateOne.mock.calls[0][1].$set as Record<string, string>;
    expect($set).not.toHaveProperty('ocr.apiKeyEncrypted');
    expect($set['ocr.endpoint']).toBe('https://vi-du.test/ocr');
  });

  it('gửi apiKey rỗng là chủ động XOÁ khoá', async () => {
    const { service, updateOne } = dungService({ banGhi: null });

    await service.updateOcr({ apiKey: '' }, 'canbo.a');

    const $set = updateOne.mock.calls[0][1].$set as Record<string, string>;
    expect($set['ocr.apiKeyEncrypted']).toBe('');
  });

  it('luôn ghi vào đúng MỘT bản ghi cấu hình', async () => {
    const { service, updateOne } = dungService({ banGhi: null });

    await service.updateOcr({ provider: 'mock' }, 'canbo.a');

    expect(updateOne.mock.calls[0][0]).toEqual({ settingsKey: 'default' });
    expect(updateOne.mock.calls[0][2]).toEqual({ upsert: true });
  });
});
