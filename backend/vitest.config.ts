import { defineConfig } from 'vitest/config';

// Prevent direct vitest/test:watch invocations from loading and mutating the demo database.
const testDatabase = process.env.ISOLATED_TEST_DATABASE;
if (!testDatabase || !/^test_[a-zA-Z0-9_]+_[a-f0-9]{32}$/.test(testDatabase) ||
    process.env.DB_NAME !== testDatabase || new URL(process.env.DATABASE_URL ?? 'mysql://localhost').pathname !== `/${testDatabase}`) {
  throw new Error('Chạy npm test để tạo database kiểm thử riêng. Không chạy Vitest trực tiếp trên database demo.');
}

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
  },
});
