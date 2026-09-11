import {
  buildEpochRangeFilter,
  endOfVnDayMs,
  daysLeftMs,
  formatVnDateMs,
  formatVnDateTimeMs,
  parseVnDateMs,
  toEpochMs,
  vnDaysBetween,
  vnMonthRangeMs,
  vnStartOfDayMs,
  vnYearOf,
} from './epoch';

const VN_OFFSET_MS = 7 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

describe('parseVnDateMs', () => {
  it('trả mốc HẾT ngày theo giờ Việt Nam (23:59:59.999 giờ VN)', () => {
    const ms = parseVnDateMs('11/09/2026') as number;
    // Đọc lại theo giờ VN bằng cách cộng lệch giờ rồi dùng getUTC*
    const vn = new Date(ms + VN_OFFSET_MS);
    expect(vn.getUTCFullYear()).toBe(2026);
    expect(vn.getUTCMonth()).toBe(8); // tháng 9
    expect(vn.getUTCDate()).toBe(11);
    expect(vn.getUTCHours()).toBe(23);
    expect(vn.getUTCMinutes()).toBe(59);
    expect(vn.getUTCSeconds()).toBe(59);
    expect(vn.getUTCMilliseconds()).toBe(999);
  });

  it('neo vào giờ Việt Nam, KHÔNG phụ thuộc giờ máy chủ', () => {
    // 23:59:59.999 giờ VN = 16:59:59.999 UTC cùng ngày
    const ms = parseVnDateMs('11/09/2026') as number;
    expect(new Date(ms).toISOString()).toBe('2026-09-11T16:59:59.999Z');
  });

  it('chấp nhận 29/02/2024 vì 2024 là năm nhuận', () => {
    expect(parseVnDateMs('29/02/2024')).toBeDefined();
  });

  it('từ chối 29/02/2026 vì 2026 không nhuận', () => {
    expect(parseVnDateMs('29/02/2026')).toBeUndefined();
  });

  it('từ chối ngày không tồn tại thay vì cuộn sang tháng sau', () => {
    expect(parseVnDateMs('31/02/2026')).toBeUndefined();
    expect(parseVnDateMs('32/01/2026')).toBeUndefined();
    expect(parseVnDateMs('11/13/2026')).toBeUndefined();
  });

  it('từ chối định dạng khác dd/MM/yyyy', () => {
    expect(parseVnDateMs('2026-09-11')).toBeUndefined();
    expect(parseVnDateMs('1/9/2026')).toBeUndefined();
    expect(parseVnDateMs('')).toBeUndefined();
    expect(parseVnDateMs(null)).toBeUndefined();
    expect(parseVnDateMs(undefined)).toBeUndefined();
  });

  it('bỏ qua khoảng trắng thừa hai đầu', () => {
    expect(parseVnDateMs('  11/09/2026  ')).toBe(parseVnDateMs('11/09/2026'));
  });
});

describe('formatVnDateMs', () => {
  it('là phép nghịch đảo của parseVnDateMs', () => {
    for (const day of ['01/01/2026', '11/09/2026', '31/12/2026', '29/02/2024']) {
      expect(formatVnDateMs(parseVnDateMs(day) as number)).toBe(day);
    }
  });

  it('mốc 17:00 UTC vẫn là NGÀY HÔM SAU theo giờ Việt Nam', () => {
    // 11/09/2026 17:00 UTC = 12/09/2026 00:00 giờ VN
    const ms = Date.UTC(2026, 8, 11, 17, 0, 0);
    expect(formatVnDateMs(ms)).toBe('12/09/2026');
  });
});

describe('formatVnDateTimeMs', () => {
  it('định dạng giờ 24h theo giờ Việt Nam', () => {
    // 07:30 UTC = 14:30 giờ VN
    const ms = Date.UTC(2026, 8, 11, 7, 30, 0);
    expect(formatVnDateTimeMs(ms)).toBe('14:30 11/09/2026');
  });

  it('giờ sau trưa KHÔNG dùng AM/PM', () => {
    const ms = Date.UTC(2026, 8, 11, 13, 5, 0); // 20:05 giờ VN
    expect(formatVnDateTimeMs(ms)).toBe('20:05 11/09/2026');
  });
});

describe('vnStartOfDayMs', () => {
  it('trả 00:00 giờ Việt Nam = 17:00 UTC ngày trước', () => {
    expect(new Date(vnStartOfDayMs('2026-09-11')).toISOString()).toBe('2026-09-10T17:00:00.000Z');
  });
});

describe('toEpochMs', () => {
  it('giữ nguyên số hợp lệ', () => {
    expect(toEpochMs(1789036200000)).toBe(1789036200000);
    expect(toEpochMs(0)).toBe(0);
  });

  it('đổi Date sang số', () => {
    const d = new Date('2026-09-11T07:30:00.000Z');
    expect(toEpochMs(d)).toBe(d.getTime());
  });

  it('đọc chuỗi toàn số (epoch gửi qua query string)', () => {
    expect(toEpochMs('1789036200000')).toBe(1789036200000);
  });

  it('đọc chuỗi ISO', () => {
    expect(toEpochMs('2026-09-11T07:30:00.000Z')).toBe(Date.UTC(2026, 8, 11, 7, 30));
  });

  it('trả undefined khi KHÔNG chắc hiểu đúng — không đoán', () => {
    expect(toEpochMs(undefined)).toBeUndefined();
    expect(toEpochMs(null)).toBeUndefined();
    expect(toEpochMs('')).toBeUndefined();
    expect(toEpochMs('hôm qua')).toBeUndefined();
    expect(toEpochMs(Number.NaN)).toBeUndefined();
    expect(toEpochMs(new Date('không phải ngày'))).toBeUndefined();
    expect(toEpochMs({})).toBeUndefined();
  });
});

describe('buildEpochRangeFilter', () => {
  it('mốc đầu là 00:00 giờ Việt Nam của ngày "từ"', () => {
    const f = buildEpochRangeFilter('createdAt', '2026-03-01') as {
      createdAt: { $gte: number };
    };
    expect(f.createdAt.$gte).toBe(vnStartOfDayMs('2026-03-01'));
  });

  it('mốc cuối là 00:00 NGÀY KẾ TIẾP với $lt, không phải 23:59:59', () => {
    const f = buildEpochRangeFilter('createdAt', undefined, '2026-03-31') as {
      createdAt: { $lt: number };
    };
    expect(f.createdAt.$lt).toBe(vnStartOfDayMs('2026-03-31') + DAY_MS);
  });

  it('bản ghi lúc 23:59:59.500 ngày cuối vẫn nằm TRONG khoảng', () => {
    const f = buildEpochRangeFilter('createdAt', '2026-03-01', '2026-03-31') as {
      createdAt: { $gte: number; $lt: number };
    };
    const cuoiNgay = (parseVnDateMs('31/03/2026') as number) - 499; // 23:59:59.500 giờ VN
    expect(cuoiNgay).toBeGreaterThanOrEqual(f.createdAt.$gte);
    expect(cuoiNgay).toBeLessThan(f.createdAt.$lt);
  });

  it('trả undefined khi không có mốc nào', () => {
    expect(buildEpochRangeFilter('createdAt')).toBeUndefined();
  });
});

describe('daysLeftMs', () => {
  const hanTrua = Date.UTC(2026, 8, 11, 5, 0, 0); // 12:00 giờ VN 11/09

  it('âm khi đã quá hạn', () => {
    expect(daysLeftMs(hanTrua, hanTrua + 3 * DAY_MS)).toBe(-3);
  });

  it('dương khi còn hạn', () => {
    expect(daysLeftMs(hanTrua, hanTrua - 3 * DAY_MS)).toBe(3);
  });

  it('làm tròn LÊN: còn 2 giờ vẫn là còn 1 ngày', () => {
    expect(daysLeftMs(hanTrua, hanTrua - 2 * 60 * 60_000)).toBe(1);
  });
});

describe('endOfVnDayMs', () => {
  it('chuẩn hoá mốc giữa ngày về hết ngày đó theo giờ Việt Nam', () => {
    const giuaNgay = Date.UTC(2026, 8, 11, 3, 0, 0); // 10:00 giờ VN 11/09
    expect(endOfVnDayMs(giuaNgay)).toBe(parseVnDateMs('11/09/2026'));
  });

  it('mốc 00:00 giờ Việt Nam vẫn thuộc chính ngày đó, không lùi một ngày', () => {
    const dauNgay = vnStartOfDayMs('2026-09-11');
    expect(endOfVnDayMs(dauNgay)).toBe(parseVnDateMs('11/09/2026'));
  });

  it('mốc 18:00 UTC là ngày HÔM SAU theo giờ Việt Nam', () => {
    // 11/09 18:00 UTC = 12/09 01:00 giờ VN
    const ms = Date.UTC(2026, 8, 11, 18, 0, 0);
    expect(endOfVnDayMs(ms)).toBe(parseVnDateMs('12/09/2026'));
  });

  it('không đổi nữa khi đã là mốc hết ngày (chạy lại vẫn ra cùng kết quả)', () => {
    const het = parseVnDateMs('11/09/2026') as number;
    expect(endOfVnDayMs(het)).toBe(het);
  });
});

describe('vnDaysBetween', () => {
  const homNayTrua = Date.UTC(2026, 8, 11, 5, 0, 0); // 12:00 giờ VN 11/09

  it('hạn trong CÙNG ngày trả 0, bất kể mấy giờ', () => {
    expect(vnDaysBetween(parseVnDateMs('11/09/2026') as number, homNayTrua)).toBe(0);
    expect(vnDaysBetween(vnStartOfDayMs('2026-09-11'), homNayTrua)).toBe(0);
  });

  it('hạn ngày mai trả 1, hạn hôm qua trả -1', () => {
    expect(vnDaysBetween(parseVnDateMs('12/09/2026') as number, homNayTrua)).toBe(1);
    expect(vnDaysBetween(parseVnDateMs('10/09/2026') as number, homNayTrua)).toBe(-1);
  });

  it('không bị lệch một ngày khi mốc rơi vào 23 giờ giờ Việt Nam', () => {
    // 11/09 16:30 UTC = 11/09 23:30 giờ VN — vẫn là hôm nay
    const toiMuon = Date.UTC(2026, 8, 11, 16, 30, 0);
    expect(vnDaysBetween(parseVnDateMs('11/09/2026') as number, toiMuon)).toBe(0);
  });
});

describe('vnMonthRangeMs', () => {
  it('biên tháng neo vào giờ Việt Nam, không phải giờ máy chủ', () => {
    const giuaThang = Date.UTC(2026, 8, 15, 10, 0, 0);
    const { from, to } = vnMonthRangeMs(giuaThang);
    // 01/09/2026 00:00 giờ VN = 31/08/2026 17:00 UTC
    expect(new Date(from).toISOString()).toBe('2026-08-31T17:00:00.000Z');
    expect(new Date(to).toISOString()).toBe('2026-09-30T17:00:00.000Z');
  });

  it('phiếu gửi 02:00 ngày 01 giờ Việt Nam nằm TRONG tháng đó', () => {
    // Đây chính là bản ghi bị bản v1 đếm sang tháng trước
    const somNgayMot = Date.UTC(2026, 7, 31, 19, 0, 0); // 01/09 02:00 giờ VN
    const { from, to } = vnMonthRangeMs(somNgayMot);
    expect(somNgayMot).toBeGreaterThanOrEqual(from);
    expect(somNgayMot).toBeLessThan(to);
  });
});

describe('vnYearOf', () => {
  it('mốc 31/12 lúc 18:00 UTC đã là năm sau theo giờ Việt Nam', () => {
    expect(vnYearOf(Date.UTC(2026, 11, 31, 18, 0, 0))).toBe(2027);
  });
});
