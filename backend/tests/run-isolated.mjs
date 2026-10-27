import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import mariadb from 'mariadb';

loadEnv({ path: resolve('.env') });

const sourceDatabase = process.env.DB_NAME;
const testDatabaseBase = process.env.TEST_DB_NAME || `test_${sourceDatabase}`;

if (!sourceDatabase) {
  throw new Error('DB_NAME chưa được cấu hình. Không thể chuẩn bị database kiểm thử.');
}

if (!/^test_[a-zA-Z0-9_]+$/.test(testDatabaseBase) || testDatabaseBase === sourceDatabase) {
  throw new Error(
    `TEST_DB_NAME phải bắt đầu bằng "test_" và khác DB_NAME. Giá trị hiện tại: ${testDatabaseBase}`,
  );
}

const testDatabase = `${testDatabaseBase}_${randomUUID().replaceAll('-', '')}`;
if (testDatabase.length > 64) throw new Error('TEST_DB_NAME tối đa 31 ký tự để dành chỗ cho mã chạy riêng.');

const databaseUrl = new URL('mysql://localhost');
databaseUrl.hostname = process.env.DB_HOST || '127.0.0.1';
databaseUrl.port = process.env.DB_PORT || '3306';
databaseUrl.username = process.env.DB_USER;
databaseUrl.password = process.env.DB_PASSWORD || '';
databaseUrl.pathname = `/${testDatabase}`;

const testEnv = {
  ...process.env,
  NODE_ENV: 'test',
  CRON_ENABLED: 'false',
  DB_NAME: testDatabase,
  ISOLATED_TEST_DATABASE: testDatabase,
  DATABASE_URL: databaseUrl.toString(),
};

const connectionOptions = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

const connection = await mariadb.createConnection(connectionOptions);

try {
  await connection.query(
    `CREATE DATABASE \`${testDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
} finally {
  await connection.end();
}

const run = (entry, args, cwd = process.cwd(), env = testEnv) => {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd,
    env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Lệnh kiểm thử thất bại với mã ${result.status ?? 1}: ${args.join(' ')}`);
  }
};

const prismaCli = resolve('node_modules/prisma/build/index.js');
const vitestCli = resolve('node_modules/vitest/vitest.mjs');

if (!existsSync(prismaCli) || !existsSync(vitestCli)) {
  throw new Error('Thiếu dependency kiểm thử. Hãy chạy npm install trước.');
}

process.stdout.write(`Chuẩn bị database kiểm thử biệt lập: ${testDatabase}\n`);
const children = [];
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function start(args, cwd, env, url) {
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: 'ignore' });
  children.push(child);
  let spawnError;
  child.once('error', error => { spawnError = error; });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Server kiểm thử dừng sớm: ${args.join(' ')}`);
    try { if ((await globalThis.fetch(url)).ok) return; } catch { /* wait for startup */ }
    await delay(250);
  }
  throw new Error(`Server kiểm thử không sẵn sàng: ${url}`);
}
try {
  run(prismaCli, ['migrate', 'deploy']);
  run(prismaCli, ['db', 'seed']);
  run(vitestCli, ['run']);
  if (process.argv.includes('--clients')) {
    const apiPort = await freePort(), webPort = await freePort();
    const webRoot = resolve('../web-admin'), mobileRoot = resolve('../app-baove');
    const apiUrl = `http://127.0.0.1:${apiPort}/api/v1`, webUrl = `http://127.0.0.1:${webPort}`;
    const clientEnv = { ...testEnv, PORT: String(apiPort), CORS_ORIGINS: webUrl, VITE_API_URL: apiUrl, API_URL: apiUrl, ADMIN_URL: webUrl };
    await start(['--import', 'tsx', 'src/server.ts'], process.cwd(), clientEnv, `http://127.0.0.1:${apiPort}/health`);
    const viteCli = resolve(webRoot, 'node_modules/vite/bin/vite.js');
    run(viteCli, ['build', '--outDir', 'tests/artifacts/audit-dist'], webRoot, { ...clientEnv, NODE_ENV: 'production' });
    await start([viteCli, 'preview', '--outDir', 'tests/artifacts/audit-dist', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], webRoot, clientEnv, webUrl);
    run(resolve(webRoot, 'tests/smoke.mjs'), [], webRoot, clientEnv);
    run(resolve(webRoot, 'tests/business-flow.mjs'), [], webRoot, clientEnv);
    run(resolve(mobileRoot, 'tests/api-smoke.mjs'), [], mobileRoot, clientEnv);
  }
} finally {
  for (const child of children.reverse()) {
    if (child.exitCode === null) {
      const closed = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await Promise.race([closed, delay(3000)]);
    }
  }
  const cleanupConnection = await mariadb.createConnection(connectionOptions);
  try {
    await cleanupConnection.query(`DROP DATABASE IF EXISTS \`${testDatabase}\``);
    process.stdout.write(`Đã dọn database kiểm thử: ${testDatabase}\n`);
  } finally {
    await cleanupConnection.end();
  }
}
