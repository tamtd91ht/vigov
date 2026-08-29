import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { TaskDocument } from '@vigov/shared';
import { duplicateKeyError, fakeDoc, queryChain } from '../../../../../test/support/mongoose-mock';
import type { RealtimeService } from '../realtime/realtime.service';
import {
  TASK_STATUS_DONE,
  TASK_STATUS_NEW,
  TASK_STATUS_WAITING_APPROVAL,
  TasksService,
  formatVnDate,
  parseVnDate,
} from './tasks.service';

/* ─────────────────────────── Tiện ích dựng mock ─────────────────────────── */

interface TaskModelMock {
  model: Model<TaskDocument>;
  created: Record<string, unknown>[];
  createMock: jest.Mock;
  findMock: jest.Mock;
}

/**
 * Model Task giả: `find()` lọc danh sách mã có sẵn đúng theo RegExp mà service
 * truyền vào (nhờ vậy test bắt được lỗi lọc sai năm), `create()` ghi lại payload.
 */
function taskModelMock(existingCodes: string[] = []): TaskModelMock {
  const created: Record<string, unknown>[] = [];

  const findMock = jest.fn((filter: { code: RegExp }) =>
    queryChain(existingCodes.filter((code) => filter.code.test(code)).map((code) => ({ code }))),
  );

  const createMock = jest.fn(async (payload: Record<string, unknown>) => {
    created.push(payload);
    return fakeDoc({ ...payload, _id: `id-${created.length}` });
  });

  const model = { find: findMock, create: createMock } as unknown as Model<TaskDocument>;
  return { model, created, createMock, findMock };
}

const realtimeMock = () => ({ emitChange: jest.fn() }) as unknown as RealtimeService;

const VALID_TASK = {
  title: 'Rà soát quỹ đất công ích',
  assignee: 'Lê Minh Tuấn',
  department: 'Địa chính – Xây dựng',
  deadline: '30/09/2026',
};

/* ─────────────────────────────── parseVnDate ─────────────────────────────── */

describe('parseVnDate', () => {
  it('trả mốc CUỐI ngày 23:59:59.999 để hạn tính hết ngày', () => {
    const date = parseVnDate('30/09/2026') as Date;
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8); // tháng 9 (đếm từ 0)
    expect(date.getDate()).toBe(30);
    expect([date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()]).toEqual([
      23, 59, 59, 999,
    ]);
  });

  it.each([
    ['31/02/2026', 'ngày 31 tháng 2 không tồn tại'],
    ['30/02/2026', 'tháng 2 chỉ có tối đa 29 ngày'],
    ['29/02/2026', '2026 không phải năm nhuận'],
    ['31/04/2026', 'tháng 4 chỉ có 30 ngày'],
    ['31/06/2026', 'tháng 6 chỉ có 30 ngày'],
    ['32/01/2026', 'không có ngày 32'],
    ['00/01/2026', 'không có ngày 0'],
    ['15/13/2026', 'không có tháng 13'],
    ['15/00/2026', 'không có tháng 0'],
  ])('từ chối %s (%s)', (input) => {
    expect(parseVnDate(input)).toBeUndefined();
  });

  it('chấp nhận 29/02/2024 vì 2024 là năm nhuận', () => {
    const date = parseVnDate('29/02/2024') as Date;
    expect(date).toBeInstanceOf(Date);
    expect(date.getDate()).toBe(29);
    expect(date.getMonth()).toBe(1);
  });

  it.each([
    ['', 'chuỗi rỗng'],
    ['1/1/2026', 'thiếu số 0 đứng đầu'],
    ['2026-09-30', 'định dạng ISO'],
    ['30/09/26', 'năm chỉ 2 chữ số'],
    ['ngày mai', 'không phải ngày'],
    ['30/09/2026 08:00', 'thừa phần giờ'],
  ])('trả undefined với %s (%s)', (input) => {
    expect(parseVnDate(input)).toBeUndefined();
  });

  it('trả undefined khi không truyền gì', () => {
    expect(parseVnDate()).toBeUndefined();
    expect(parseVnDate(null)).toBeUndefined();
  });

  it('bỏ qua khoảng trắng thừa hai đầu', () => {
    expect(parseVnDate('  30/09/2026  ')).toBeInstanceOf(Date);
  });

  it('formatVnDate là phép nghịch đảo của parseVnDate', () => {
    expect(formatVnDate(parseVnDate('05/03/2026') as Date)).toBe('05/03/2026');
  });
});

/* ─────────────────────────── Sinh mã nhiệm vụ ─────────────────────────── */

describe('TasksService — sinh mã NV-<yy><stt>', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15, 10, 0, 0));
  });

  afterEach(() => jest.useRealTimers());

  const createTask = async (mock: TaskModelMock) =>
    new TasksService(mock.model, realtimeMock()).create({ ...VALID_TASK } as never);

  it('bắt đầu từ NV-2601 khi trong năm chưa có nhiệm vụ nào', async () => {
    const mock = taskModelMock([]);
    const task = await createTask(mock);
    expect(task.code).toBe('NV-2601');
  });

  it('tăng bình thường trong khoảng 2 chữ số: NV-2609 → NV-2610', async () => {
    const mock = taskModelMock(['NV-2601', 'NV-2609', 'NV-2605']);
    expect((await createTask(mock)).code).toBe('NV-2610');
  });

  it('VƯỢT 2 chữ số vẫn tăng đúng: NV-2699 → NV-26100', async () => {
    const mock = taskModelMock(['NV-2698', 'NV-2699']);
    expect((await createTask(mock)).code).toBe('NV-26100');
  });

  it('so sánh theo GIÁ TRỊ SỐ chứ không theo chuỗi: NV-26100 → NV-26101', async () => {
    // So chuỗi sẽ chọn nhầm 'NV-2699' > 'NV-26100' và sinh lại mã đã tồn tại
    const mock = taskModelMock(['NV-2699', 'NV-26100', 'NV-2610']);
    expect((await createTask(mock)).code).toBe('NV-26101');
  });

  it('chuyển đúng sang 4 chữ số: NV-26999 → NV-261000', async () => {
    const mock = taskModelMock(['NV-26999']);
    expect((await createTask(mock)).code).toBe('NV-261000');
  });

  it('bỏ qua mã của NĂM KHÁC khi đánh số', async () => {
    const mock = taskModelMock(['NV-2599', 'NV-27500']);
    expect((await createTask(mock)).code).toBe('NV-2601');
    // Truy vấn phải chốt đúng tiền tố năm hiện tại
    expect((mock.findMock.mock.calls[0][0] as { code: RegExp }).code.source).toBe('^NV-26\\d+$');
  });

  it('sinh lại mã khi gặp lỗi trùng khoá do tạo đồng thời', async () => {
    const mock = taskModelMock(['NV-2601']);
    mock.createMock.mockRejectedValueOnce(duplicateKeyError());

    const task = await createTask(mock);
    expect(mock.createMock).toHaveBeenCalledTimes(2);
    expect(task.code).toBe('NV-2602');
  });

  it('lỗi KHÔNG phải trùng khoá thì ném ra ngay, không thử lại', async () => {
    const mock = taskModelMock([]);
    mock.createMock.mockRejectedValueOnce(new Error('mất kết nối'));

    await expect(createTask(mock)).rejects.toThrow('mất kết nối');
    expect(mock.createMock).toHaveBeenCalledTimes(1);
  });

  it('bỏ cuộc sau đúng 5 lần trùng khoá liên tiếp', async () => {
    const mock = taskModelMock([]);
    mock.createMock.mockRejectedValue(duplicateKeyError());

    // Lần thử thứ 5 không còn "continue" nên lỗi trùng khoá gốc được ném ra
    // (nhánh BadRequestException cuối hàm là mã chết — xem báo cáo P5-07)
    await expect(createTask(mock)).rejects.toMatchObject({ code: 11000 });
    expect(mock.createMock).toHaveBeenCalledTimes(5);
  });
});

/* ───────────────────── Tạo nhiệm vụ: hạn & tiến độ ban đầu ───────────────────── */

describe('TasksService.create', () => {
  it('từ chối hạn xử lý không tồn tại (31/02/2026)', async () => {
    const mock = taskModelMock([]);
    const service = new TasksService(mock.model, realtimeMock());

    await expect(service.create({ ...VALID_TASK, deadline: '31/02/2026' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mock.createMock).not.toHaveBeenCalled();
  });

  it('tiến độ ban đầu = 0 khi mọi việc con chưa tick', async () => {
    const mock = taskModelMock([]);
    const service = new TasksService(mock.model, realtimeMock());

    await service.create({
      ...VALID_TASK,
      checklist: [{ title: 'Trích lục hồ sơ' }, { title: 'Đo đạc hiện trạng' }],
    } as never);

    expect(mock.created[0].progress).toBe(0);
    expect(mock.created[0].status).toBe(TASK_STATUS_NEW);
  });

  it('tiến độ ban đầu tính theo số việc con đã tick sẵn', async () => {
    const mock = taskModelMock([]);
    const service = new TasksService(mock.model, realtimeMock());

    await service.create({
      ...VALID_TASK,
      checklist: [{ title: 'A', done: true }, { title: 'B' }, { title: 'C' }, { title: 'D' }],
    } as never);

    expect(mock.created[0].progress).toBe(25);
  });

  it('ghi tên người giao lấy từ phiên đăng nhập', async () => {
    const mock = taskModelMock([]);
    const service = new TasksService(mock.model, realtimeMock());

    await service.create({ ...VALID_TASK } as never, { displayName: 'Nguyễn Văn Bình' } as never);
    expect(mock.created[0].assigner).toBe('Nguyễn Văn Bình');
  });

  it('không có phiên đăng nhập thì người giao là "Hệ thống"', async () => {
    const mock = taskModelMock([]);
    const service = new TasksService(mock.model, realtimeMock());

    await service.create({ ...VALID_TASK } as never);
    expect(mock.created[0].assigner).toBe('Hệ thống');
  });
});

/* ─────────────────── Tick việc con → tính lại tiến độ ─────────────────── */

describe('TasksService.toggleChecklistItem', () => {
  const buildTask = (titles: string[], done: boolean[] = []) =>
    fakeDoc({
      code: 'NV-2601',
      status: TASK_STATUS_NEW,
      progress: 0,
      department: 'Địa chính – Xây dựng',
      assignee: 'Lê Minh Tuấn',
      deadline: '30/09/2026',
      timeline: [] as unknown[],
      checklist: titles.map((title, i) => ({ title, done: done[i] ?? false })),
    });

  const serviceFor = (task: ReturnType<typeof buildTask>) => {
    const realtime = realtimeMock();
    const model = {
      findOne: jest.fn(() => ({ exec: jest.fn(async () => task) })),
    } as unknown as Model<TaskDocument>;
    return { service: new TasksService(model, realtime), realtime };
  };

  it('tick 1/3 việc con → 33% (làm tròn)', async () => {
    const task = buildTask(['A', 'B', 'C']);
    const { service } = serviceFor(task);

    const result = await service.toggleChecklistItem('NV-2601', 0, true);
    expect(result.progress).toBe(33);
    expect(task.checklist[0].done).toBe(true);
    expect(task.save).toHaveBeenCalled();
    expect(task.markModified).toHaveBeenCalledWith('checklist');
  });

  it('tick 2/3 việc con → 67% (làm tròn lên)', async () => {
    const task = buildTask(['A', 'B', 'C'], [true, false, false]);
    task.progress = 33;
    const { service } = serviceFor(task);

    expect((await service.toggleChecklistItem('NV-2601', 1, true)).progress).toBe(67);
  });

  it('bỏ tick thì tiến độ GIẢM tương ứng', async () => {
    const task = buildTask(['A', 'B'], [true, true]);
    task.progress = 100;
    task.status = TASK_STATUS_WAITING_APPROVAL;
    const { service } = serviceFor(task);

    expect((await service.toggleChecklistItem('NV-2601', 0, false)).progress).toBe(50);
  });

  it('không truyền "done" thì đảo trạng thái việc con', async () => {
    const task = buildTask(['A', 'B'], [false, false]);
    const { service } = serviceFor(task);

    expect((await service.toggleChecklistItem('NV-2601', 0, undefined)).progress).toBe(50);
    expect((await service.toggleChecklistItem('NV-2601', 0, undefined)).progress).toBe(0);
  });

  it('tick hết việc con → 100%, chuyển "chờ duyệt" và báo thời gian thực', async () => {
    const task = buildTask(['A', 'B'], [true, false]);
    task.progress = 50;
    const { service, realtime } = serviceFor(task);

    const result = await service.toggleChecklistItem('NV-2601', 1, true, {
      displayName: 'Lê Minh Tuấn',
    } as never);

    expect(result.progress).toBe(100);
    expect(result.status).toBe(TASK_STATUS_WAITING_APPROVAL);
    expect(task.timeline).toHaveLength(1);
    expect(realtime.emitChange).toHaveBeenCalledTimes(1);
  });

  it('nhiệm vụ ĐÃ hoàn thành thì tick lại không kéo ngược trạng thái về "chờ duyệt"', async () => {
    const task = buildTask(['A', 'B'], [true, false]);
    task.status = TASK_STATUS_DONE;
    const { service, realtime } = serviceFor(task);

    const result = await service.toggleChecklistItem('NV-2601', 1, true);
    expect(result.progress).toBe(100);
    expect(result.status).toBe(TASK_STATUS_DONE);
    expect(realtime.emitChange).not.toHaveBeenCalled();
  });

  it('đang "chờ duyệt" rồi thì không phát lại tín hiệu đổi trạng thái', async () => {
    const task = buildTask(['A', 'B'], [true, false]);
    task.status = TASK_STATUS_WAITING_APPROVAL;
    const { service, realtime } = serviceFor(task);

    await service.toggleChecklistItem('NV-2601', 1, true);
    expect(realtime.emitChange).not.toHaveBeenCalled();
  });

  it('bỏ tick việc con duy nhất → 0%', async () => {
    const task = buildTask(['A'], [true]);
    task.progress = 100;
    const { service } = serviceFor(task);
    expect((await service.toggleChecklistItem('NV-2601', 0, false)).progress).toBe(0);
  });

  it.each([[-1], [5], [1.5]])('chỉ số việc con %p không hợp lệ → 404', async (index) => {
    const task = buildTask(['A', 'B']);
    const { service } = serviceFor(task);

    await expect(service.toggleChecklistItem('NV-2601', index, true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(task.save).not.toHaveBeenCalled();
  });
});

/* ─────────────── Cập nhật nhiệm vụ: tiến độ theo checklist ─────────────── */

describe('TasksService.update', () => {
  const buildTask = () =>
    fakeDoc({
      code: 'NV-2601',
      title: 'cũ',
      status: TASK_STATUS_NEW,
      progress: 0,
      department: 'Địa chính – Xây dựng',
      assignee: 'Lê Minh Tuấn',
      deadline: '30/09/2026',
      deadlineAt: parseVnDate('30/09/2026'),
      timeline: [] as unknown[],
      checklist: [] as { title: string; done: boolean }[],
    });

  const serviceFor = (task: ReturnType<typeof buildTask>) => {
    const realtime = realtimeMock();
    const model = {
      findOne: jest.fn(() => ({ exec: jest.fn(async () => task) })),
    } as unknown as Model<TaskDocument>;
    return { service: new TasksService(model, realtime), realtime };
  };

  it('thay danh sách việc con thì TÍNH LẠI tiến độ từ danh sách mới', async () => {
    const task = buildTask();
    task.progress = 99; // giá trị cũ phải bị ghi đè
    const { service } = serviceFor(task);

    const result = await service.update('NV-2601', {
      checklist: [{ title: 'A', done: true }, { title: 'B', done: true }, { title: 'C' }],
    } as never);

    expect(result.progress).toBe(67);
  });

  it('chuyển trạng thái "xong" thì tiến độ ép về 100% và phát tín hiệu', async () => {
    const task = buildTask();
    task.progress = 40;
    const { service, realtime } = serviceFor(task);

    const result = await service.update('NV-2601', { status: TASK_STATUS_DONE } as never);
    expect(result.progress).toBe(100);
    expect(realtime.emitChange).toHaveBeenCalledTimes(1);
  });

  it('trạng thái không đổi thì KHÔNG phát tín hiệu thời gian thực', async () => {
    const task = buildTask();
    const { service, realtime } = serviceFor(task);

    await service.update('NV-2601', { status: TASK_STATUS_NEW, title: 'mới' } as never);
    expect(realtime.emitChange).not.toHaveBeenCalled();
    expect(task.title).toBe('mới');
  });

  it('từ chối đổi sang hạn xử lý không tồn tại và giữ nguyên hạn cũ', async () => {
    const task = buildTask();
    const { service } = serviceFor(task);

    await expect(service.update('NV-2601', { deadline: '31/11/2026' } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(task.deadline).toBe('30/09/2026');
  });

  it('ghi nhật ký khi tiến độ được sửa tay', async () => {
    const task = buildTask();
    const { service } = serviceFor(task);

    await service.update('NV-2601', { progress: 60 } as never, { displayName: 'Bình' } as never);
    expect(task.progress).toBe(60);
    expect(task.timeline).toHaveLength(1);
    expect((task.timeline[0] as { title: string }).title).toBe('Cập nhật tiến độ 60%');
  });
});

/* ───────────────────────── Đếm ngày còn lại ───────────────────────── */

describe('TasksService.daysLeft', () => {
  const service = () => new TasksService(taskModelMock().model, realtimeMock());

  it('âm khi đã quá hạn', () => {
    const task = { deadlineAt: new Date(2026, 5, 10, 23, 59, 59, 999) } as TaskDocument;
    expect(service().daysLeft(task, new Date(2026, 5, 15, 12, 0, 0))).toBeLessThan(0);
  });

  it('dương khi còn hạn', () => {
    const task = { deadlineAt: new Date(2026, 5, 20, 23, 59, 59, 999) } as TaskDocument;
    expect(service().daysLeft(task, new Date(2026, 5, 15, 12, 0, 0))).toBe(6);
  });

  it('trả 0 khi nhiệm vụ không đặt hạn', () => {
    expect(service().daysLeft({} as TaskDocument, new Date())).toBe(0);
  });
});
