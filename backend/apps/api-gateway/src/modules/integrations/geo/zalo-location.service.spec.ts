import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { GeoService } from './geo.service';
import { ZaloLocationService } from './zalo-location.service';

/**
 * Kiểm thử bước đổi mã định vị Zalo lấy toạ độ (P3-26).
 *
 * Ba thứ dễ sai lặng lẽ, và cả ba đều dẫn tới việc cán bộ tới nhầm nơi:
 *   · Zalo trả toạ độ dạng CHUỖI. Chuỗi rỗng ép sang Number thành 0, mà (0,0)
 *     là một điểm giữa Đại Tây Dương — phải bị từ chối, không được ghim lên bản đồ.
 *   · Provider GIS "mock" BỊA địa chỉ từ toạ độ. Phải nói ra là bịa, để Mini App
 *     không hiện nó cho công dân như địa chỉ thật.
 *   · Tra địa chỉ hỏng KHÔNG được làm mất toạ độ — có toạ độ là đã đủ vẽ bản đồ.
 */

const OK_LAT = '20.74318';
const OK_LNG = '105.92147';

function makeService(opts: {
  fetchBody?: unknown;
  fetchThrows?: boolean;
  secret?: string;
  provider?: string;
  reverse?: () => Promise<string | null>;
}) {
  const config = {
    get: jest.fn((key: string, fallback?: string) =>
      key === 'zalo.appSecret' ? (opts.secret ?? 'secret-test') : fallback,
    ),
  } as unknown as ConfigService;

  const geo = {
    providerName: opts.provider ?? 'mock',
    reverse: jest.fn(opts.reverse ?? (async () => 'Số 12, Thôn Đông')),
  } as unknown as GeoService;

  global.fetch = jest.fn(async () => {
    if (opts.fetchThrows) throw new Error('mạng hỏng');
    return {
      ok: true,
      json: async () => opts.fetchBody ?? { error: 0, data: { latitude: OK_LAT, longitude: OK_LNG } },
    } as Response;
  }) as unknown as typeof fetch;

  return { service: new ZaloLocationService(config, geo), geo };
}

describe('ZaloLocationService', () => {
  it('đổi toạ độ dạng chuỗi của Zalo thành số', async () => {
    const { service } = makeService({});
    const res = await service.resolve('ma-dinh-vi', 'access-token');

    expect(res.lat).toBeCloseTo(20.74318);
    expect(res.lng).toBeCloseTo(105.92147);
  });

  it('nói rõ địa chỉ do provider nào sinh ra', async () => {
    const { service } = makeService({ provider: 'mock' });
    const res = await service.resolve('ma-dinh-vi', 'access-token');

    // Mini App dựa vào đúng trường này để KHÔNG hiện địa chỉ bịa cho công dân
    expect(res.addressProvider).toBe('mock');
    expect(res.address).toBe('Số 12, Thôn Đông');
  });

  /**
   * Phép thử quan trọng nhất của tệp này. Zalo trả toạ độ dạng chuỗi, nên một
   * phản hồi thiếu trường sẽ ép thành 0 — và (0,0) là toạ độ HỢP LỆ về mặt
   * kiểm tra miền giá trị. Ghim nó lên phiếu là phiếu chỉ vào giữa đại dương.
   */
  it('từ chối toạ độ (0,0) do trường rỗng ép sang số', async () => {
    const { service } = makeService({ fetchBody: { error: 0, data: { latitude: '', longitude: '' } } });

    await expect(service.resolve('ma-dinh-vi', 'access-token')).rejects.toThrow(ServiceUnavailableException);
  });

  it('từ chối khi Zalo báo lỗi nghiệp vụ dù HTTP 200', async () => {
    const { service } = makeService({ fetchBody: { error: -201, message: 'code không hợp lệ' } });

    await expect(service.resolve('ma-dinh-vi', 'access-token')).rejects.toThrow(ServiceUnavailableException);
  });

  it('từ chối khi chưa cấu hình ZALO_APP_SECRET, không gọi Zalo', async () => {
    const { service } = makeService({ secret: '' });

    await expect(service.resolve('ma-dinh-vi', 'access-token')).rejects.toThrow(ServiceUnavailableException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('vẫn trả toạ độ khi tra địa chỉ hỏng', async () => {
    const { service } = makeService({
      reverse: async () => {
        throw new Error('provider GIS không phản hồi');
      },
    });

    const res = await service.resolve('ma-dinh-vi', 'access-token');
    expect(res.lat).toBeCloseTo(20.74318);
    expect(res.address).toBeNull();
  });
});
