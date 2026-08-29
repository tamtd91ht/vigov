/**
 * Cấu hình Jest cho UNIT TEST (P5-07).
 *
 * Unit test đặt cạnh mã nguồn (`*.spec.ts` trong apps/ và libs/) và KHÔNG chạm
 * cơ sở dữ liệu — mọi model Mongoose đều được thay bằng mock.
 *
 * Test đầu-cuối nằm riêng ở thư mục `test/` và chạy bằng `npm run test:e2e`
 * (cấu hình `test/jest-e2e.json`); `roots` bên dưới cố tình không bao gồm
 * thư mục đó để hai nhóm test không giẫm chân nhau.
 */
module.exports = {
  rootDir: '.',
  roots: ['<rootDir>/apps', '<rootDir>/libs'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  testRegex: '\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@vigov/shared(|/.*)$': '<rootDir>/libs/shared/src$1',
  },
  collectCoverageFrom: [
    'apps/**/*.service.ts',
    'libs/**/*.ts',
    '!**/*.module.ts',
    '!**/*.schema.ts',
  ],
  testTimeout: 20_000,
};
