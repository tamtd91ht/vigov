import { Schema, model, connection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { applyEpochTimestamps } from './timestamped';

/**
 * Khoá hành vi của `applyEpochTimestamps` bằng MongoDB thật trong bộ nhớ.
 *
 * Phép kiểm quan trọng nhất ở đây là "tôn trọng mốc truyền tường minh": nếu hook
 * ghi đè `updatedAt` bằng thời điểm hiện tại, script di trú (P7-04) sẽ đổi mốc
 * sửa của **toàn bộ** hồ sơ hành chính thành ngày chạy di trú. Đó là mất dữ liệu
 * lưu trữ, không phải lỗi hiển thị.
 */

let mongod: MongoMemoryServer;

const GhiChuSchema = new Schema({ noiDung: String }, { collection: 'ghi_chu_test' });
applyEpochTimestamps(GhiChuSchema);
GhiChuSchema.add({ createdAt: Number, updatedAt: Number });

interface GhiChu {
  noiDung?: string;
  createdAt?: number;
  updatedAt?: number;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const GhiChu = () => model<GhiChu>('GhiChuTest', GhiChuSchema);

afterEach(async () => {
  await connection.collection('ghi_chu_test').deleteMany({});
});

describe('applyEpochTimestamps — đường save()', () => {
  it('đặt cả hai mốc dạng SỐ khi tạo bản ghi mới', async () => {
    const truoc = Date.now();
    const doc = await GhiChu().create({ noiDung: 'thử' });

    expect(typeof doc.createdAt).toBe('number');
    expect(typeof doc.updatedAt).toBe('number');
    expect(doc.createdAt).toBeGreaterThanOrEqual(truoc);
    expect(doc.updatedAt).toBe(doc.createdAt);
  });

  it('sửa rồi lưu lại thì chỉ updatedAt đổi, createdAt giữ nguyên', async () => {
    const doc = await GhiChu().create({ noiDung: 'thử' });
    const taoLuc = doc.createdAt;

    await new Promise((r) => setTimeout(r, 5));
    doc.noiDung = 'đã sửa';
    await doc.save();

    expect(doc.createdAt).toBe(taoLuc);
    expect(doc.updatedAt).toBeGreaterThan(taoLuc as number);
  });

  it('TÔN TRỌNG mốc truyền tường minh — điều kiện sống của script di trú', async () => {
    const mocCu = Date.UTC(2024, 2, 15, 3, 30); // 15/03/2024
    const mocSuaCu = Date.UTC(2024, 5, 1, 8, 0); // 01/06/2024

    const doc = await GhiChu().create({
      noiDung: 'hồ sơ di trú từ v1',
      createdAt: mocCu,
      updatedAt: mocSuaCu,
    });

    expect(doc.createdAt).toBe(mocCu);
    expect(doc.updatedAt).toBe(mocSuaCu);
  });
});

describe('applyEpochTimestamps — đường findOneAndUpdate', () => {
  it('đổi updatedAt, không đụng createdAt', async () => {
    const doc = await GhiChu().create({ noiDung: 'thử' });
    await new Promise((r) => setTimeout(r, 5));

    const sau = await GhiChu()
      .findOneAndUpdate({ _id: doc._id }, { $set: { noiDung: 'đã sửa' } }, { new: true })
      .lean();

    expect(sau?.createdAt).toBe(doc.createdAt);
    expect(sau?.updatedAt).toBeGreaterThan(doc.updatedAt as number);
  });

  it('TÔN TRỌNG updatedAt truyền tường minh trong $set', async () => {
    const doc = await GhiChu().create({ noiDung: 'thử' });
    const mocCu = Date.UTC(2024, 5, 1, 8, 0);

    const sau = await GhiChu()
      .findOneAndUpdate({ _id: doc._id }, { $set: { updatedAt: mocCu } }, { new: true })
      .lean();

    expect(sau?.updatedAt).toBe(mocCu);
  });

  it('upsert tạo bản ghi mới thì có mốc tạo', async () => {
    const sau = await GhiChu()
      .findOneAndUpdate(
        { noiDung: 'chưa tồn tại' },
        { $set: { noiDung: 'chưa tồn tại' } },
        { new: true, upsert: true },
      )
      .lean();

    expect(typeof sau?.createdAt).toBe('number');
    expect(typeof sau?.updatedAt).toBe('number');
  });
});

describe('applyEpochTimestamps — đường insertMany', () => {
  it('mọi bản ghi đều có hai mốc', async () => {
    await GhiChu().insertMany([{ noiDung: 'một' }, { noiDung: 'hai' }]);
    const rows = await GhiChu().find().lean();

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(typeof row.createdAt).toBe('number');
      expect(typeof row.updatedAt).toBe('number');
    }
  });

  it('bản ghi tự nêu mốc thì giữ nguyên', async () => {
    const mocCu = Date.UTC(2024, 2, 15);
    await GhiChu().insertMany([{ noiDung: 'cũ', createdAt: mocCu, updatedAt: mocCu }]);
    const row = await GhiChu().findOne({ noiDung: 'cũ' }).lean();

    expect(row?.createdAt).toBe(mocCu);
  });
});
