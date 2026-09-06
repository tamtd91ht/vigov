import type { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import { OtpStore } from './otp.store';
import type { OtpCodeDocument } from './otp.schema';

/**
 * Kho mã OTP (SECURITY.md TB-08).
 *
 * VÌ SAO ĐÁNG TEST RIÊNG: đây là chốt duy nhất chặn dò mã 6 chữ số. Ba điều dễ
 * hỏng lặng lẽ mà bộ test này khoá lại:
 *   · lưu mã dạng RÕ xuống kho — bản sao lưu CSDL rơi ra là lộ mã đang sống;
 *   · quên xoá mã sau khi dùng — mã dùng lại được nhiều lần;
 *   · quên huỷ mã khi nhập sai quá ngưỡng — dò hết 10⁶ khả năng bằng một mã.
 * Cả ba đều không làm hỏng luồng đăng nhập nên không test thì không ai thấy.
 */

const PHONE = '0987654321';
const SECRET = 'khoa-bi-mat-du-dai-cho-hmac-trong-kiem-thu';
const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function makeStore(driver: 'memory' | 'mongo' = 'memory') {
  const config = {
    get: (key: string) => (key === 'auth.otpStore' ? driver : key === 'auth.jwtSecret' ? SECRET : undefined),
  } as unknown as ConfigService;

  // Driver bộ nhớ không đọc bảng nào; truyền model rỗng để chắc chắn điều đó
  const otpModel = {} as unknown as Model<OtpCodeDocument>;
  return new OtpStore(otpModel, config);
}

describe('OtpStore — driver bộ nhớ', () => {
  it('xác thực đúng mã rồi TIÊU HUỶ — mã dùng một lần', async () => {
    const store = makeStore();
    await store.put(PHONE, '123456', TTL_MS);

    await expect(store.verify(PHONE, '123456', MAX_ATTEMPTS)).resolves.toBe('ok');
    // Lần hai phải trượt: mã đã bị xoá
    await expect(store.verify(PHONE, '123456', MAX_ATTEMPTS)).resolves.toBe('missing');
  });

  it('không lưu mã dạng rõ — chỉ giữ chuỗi băm', async () => {
    const store = makeStore();
    await store.put(PHONE, '123456', TTL_MS);

    // Soi thẳng bộ nhớ trong: không được thấy '123456' ở bất kỳ đâu
    const dump = JSON.stringify([...(store as unknown as { memory: Map<string, unknown> }).memory]);
    expect(dump).not.toContain('123456');
    expect(dump).toMatch(/[0-9a-f]{64}/); // HMAC-SHA256 dạng hex
  });

  it('mã hết hạn thì trượt, không cần chờ ai dọn', async () => {
    const store = makeStore();
    await store.put(PHONE, '123456', -1);

    await expect(store.verify(PHONE, '123456', MAX_ATTEMPTS)).resolves.toBe('expired');
  });

  it('nhập sai đủ ngưỡng thì HUỶ mã, buộc xin mã mới', async () => {
    const store = makeStore();
    await store.put(PHONE, '123456', TTL_MS);

    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      await expect(store.verify(PHONE, '000000', MAX_ATTEMPTS)).resolves.toBe('wrong');
    }
    // Lần sai thứ MAX_ATTEMPTS: mã bị huỷ
    await expect(store.verify(PHONE, '000000', MAX_ATTEMPTS)).resolves.toBe('exhausted');
    // Mã đúng cũng không dùng được nữa
    await expect(store.verify(PHONE, '123456', MAX_ATTEMPTS)).resolves.toBe('missing');
  });

  it('mỗi số điện thoại một mã độc lập, xin mã mới thì ghi đè mã cũ', async () => {
    const store = makeStore();
    await store.put(PHONE, '111111', TTL_MS);
    await store.put('0912345678', '222222', TTL_MS);
    await store.put(PHONE, '333333', TTL_MS);

    await expect(store.verify(PHONE, '111111', MAX_ATTEMPTS)).resolves.toBe('wrong');
    await expect(store.verify(PHONE, '333333', MAX_ATTEMPTS)).resolves.toBe('ok');
    await expect(store.verify('0912345678', '222222', MAX_ATTEMPTS)).resolves.toBe('ok');
  });

  it('clear() xoá mã đang chờ', async () => {
    const store = makeStore();
    await store.put(PHONE, '123456', TTL_MS);
    await store.clear(PHONE);

    await expect(store.verify(PHONE, '123456', MAX_ATTEMPTS)).resolves.toBe('missing');
  });
});

describe('OtpStore — chọn driver', () => {
  it('giá trị OTP_STORE lạ thì rơi về bộ nhớ chứ không sập', async () => {
    const config = {
      get: (key: string) => (key === 'auth.otpStore' ? 'redis' : key === 'auth.jwtSecret' ? SECRET : undefined),
    } as unknown as ConfigService;
    const store = new OtpStore({} as unknown as Model<OtpCodeDocument>, config);

    await store.put(PHONE, '123456', TTL_MS);
    await expect(store.verify(PHONE, '123456', MAX_ATTEMPTS)).resolves.toBe('ok');
  });

  it('driver mongo đọc/ghi qua model chứ không dùng bộ nhớ tiến trình', async () => {
    const docs = new Map<string, Record<string, unknown>>();
    const otpModel = {
      findOneAndUpdate: jest.fn((filter: { phone: string }, update: { $set: Record<string, unknown> }) => ({
        exec: async () => {
          docs.set(filter.phone, { ...update.$set });
          return null;
        },
      })),
      findOne: jest.fn((filter: { phone: string }) => ({
        exec: async () => {
          const found = docs.get(filter.phone);
          if (!found) return null;
          return {
            ...found,
            deleteOne: async () => docs.delete(filter.phone),
            save: async () => docs.set(filter.phone, found),
          };
        },
      })),
      deleteOne: jest.fn(() => ({ exec: async () => docs.delete(PHONE) })),
    } as unknown as Model<OtpCodeDocument>;

    const config = {
      get: (key: string) => (key === 'auth.otpStore' ? 'mongo' : key === 'auth.jwtSecret' ? SECRET : undefined),
    } as unknown as ConfigService;
    const store = new OtpStore(otpModel, config);

    await store.put(PHONE, '135790', TTL_MS);
    expect(docs.get(PHONE)?.codeHash).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/));
    /* Cùng lý do như driver bộ nhớ: mã rõ không được xuất hiện trong bản ghi.
       Mã chọn ở đây KHÔNG được là chuỗi con của số điện thoại, nếu không phép
       kiểm này luôn thất bại vì bản ghi có chứa số điện thoại. */
    expect(JSON.stringify([...docs])).not.toContain('135790');

    await expect(store.verify(PHONE, '135790', MAX_ATTEMPTS)).resolves.toBe('ok');
    expect(docs.has(PHONE)).toBe(false);
  });
});
