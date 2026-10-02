// downloadFile 多线程分块下载测试：本地起一个支持 Range 的服务器，
// 验证分块并发下载 + 合并后字节与源完全一致；以及不支持 Range 时回退单线程。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { downloadFile } from '../lib/tunnel.mjs';

/** 假二进制内容：4MB 可预测字节（> MIN_PARALLEL_SIZE，触发分块）。 */
function makePayload(size) {
  const buf = Buffer.allocUnsafe(size);
  for (let i = 0; i < size; i++) buf[i] = (i * 31 + 7) & 0xff;
  return buf;
}

/** 支持/不支持 Range 的服务器。 */
async function rangeServer(payload, { supportRange }) {
  const server = createServer((req, res) => {
    const range = req.headers.range;
    if (supportRange && range) {
      const m = /bytes=(\d+)-(\d+)/.exec(range);
      const start = Number(m[1]);
      const end = Number(m[2]);
      res.writeHead(206, {
        'content-type': 'application/octet-stream',
        'content-range': `bytes ${start}-${end}/${payload.length}`,
        'content-length': end - start + 1,
        'accept-ranges': 'bytes',
      });
      res.end(payload.subarray(start, end + 1));
    } else {
      res.writeHead(200, {
        'content-type': 'application/octet-stream',
        'content-length': payload.length,
        ...(supportRange ? { 'accept-ranges': 'bytes' } : {}),
      });
      res.end(payload);
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { port: server.address().port, server };
}

test('downloadFile：支持 Range 时多线程分块，合并后字节与源一致', async () => {
  const payload = makePayload(4 * 1024 * 1024);
  const { port, server } = await rangeServer(payload, { supportRange: true });
  const dir = await mkdtemp(join(tmpdir(), 'dl-par-'));
  try {
    const dest = join(dir, 'out.bin');
    const len = await downloadFile(`http://127.0.0.1:${port}/cf`, dest, { segments: 8 });
    assert.equal(len, payload.length, '返回总字节数');
    const got = await readFile(dest);
    assert.equal(got.length, payload.length, '合并后长度一致');
    assert.ok(got.equals(payload), '合并后字节完全一致');
  } finally {
    await rm(dir, { recursive: true, force: true });
    await new Promise((r) => server.close(r));
  }
});

test('downloadFile：不支持 Range 时回退单线程，字节一致', async () => {
  const payload = makePayload(3 * 1024 * 1024);
  const { port, server } = await rangeServer(payload, { supportRange: false });
  const dir = await mkdtemp(join(tmpdir(), 'dl-single-'));
  try {
    const dest = join(dir, 'out.bin');
    const len = await downloadFile(`http://127.0.0.1:${port}/cf`, dest, { segments: 8 });
    assert.equal(len, payload.length);
    const got = await readFile(dest);
    assert.ok(got.equals(payload), '单线程回退字节一致');
  } finally {
    await rm(dir, { recursive: true, force: true });
    await new Promise((r) => server.close(r));
  }
});

// ---------- PATH 探测只认可直接 spawn 的二进制（issue #82） ----------

test('pickSpawnableCloudflared（issue #82）：Windows 只认 .exe/.com，忽略 npm 的 .cmd shim', async () => {
  const { pickSpawnableCloudflared } = await import('../lib/tunnel.mjs');
  // npm 全局安装的典型输出：无扩展名 shell 脚本 + .cmd，两者 Node 的 spawn 都执行不了
  const shimOutput = 'C:\\Users\\me\\AppData\\Roaming\\npm\\cloudflared\r\nC:\\Users\\me\\AppData\\Roaming\\npm\\cloudflared.cmd\r\n';
  assert.equal(pickSpawnableCloudflared(shimOutput, 'win32'), null, 'shim 不可直接执行，应判定为没有');
  // 真正的 exe（winget/手动安装）必须命中
  assert.equal(
    pickSpawnableCloudflared('C:\\Program Files\\cloudflared\\cloudflared.exe\r\n', 'win32'),
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
  );
  // shim 与 exe 同时存在时跳过 shim，挑 exe
  assert.equal(
    pickSpawnableCloudflared('C:\\npm\\cloudflared.cmd\r\nC:\\cf\\cloudflared.exe\r\n', 'win32'),
    'C:\\cf\\cloudflared.exe',
  );
  // .com 也算可直接执行
  assert.equal(pickSpawnableCloudflared('C:\\cf\\cloudflared.com\n', 'win32'), 'C:\\cf\\cloudflared.com');
  // POSIX：只要绝对路径（相对名/alias 行不可靠，宁可回落到自带二进制）
  assert.equal(pickSpawnableCloudflared('/usr/local/bin/cloudflared\n', 'linux'), '/usr/local/bin/cloudflared');
  assert.equal(pickSpawnableCloudflared('alias cloudflared=/opt/cf\n', 'linux'), null);
  // 探测失败/空输出
  assert.equal(pickSpawnableCloudflared('', 'win32'), null);
  assert.equal(pickSpawnableCloudflared(undefined, 'darwin'), null);
});

test('resolveCloudflared（issue #82）：PATH 上只有 .cmd shim 时回落插件自带二进制', { skip: process.platform !== 'win32' }, async () => {
  const fsp = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { resolveCloudflared } = await import('../lib/tunnel.mjs');

  const home = await fsp.mkdtemp(path.join(os.tmpdir(), 'dshp-shim-home-'));
  const shimDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'dshp-shim-path-'));
  const binDir = path.join(home, 'dsh-pocket-frog', 'bin');
  await fsp.mkdir(binDir, { recursive: true });
  await fsp.writeFile(path.join(binDir, 'cloudflared.exe'), 'fake-binary');
  // 复刻 npm 全局安装：只有 cloudflared.cmd 与无扩展名脚本，没有 .exe
  await fsp.writeFile(path.join(shimDir, 'cloudflared.cmd'), '@ECHO off\r\n');
  await fsp.writeFile(path.join(shimDir, 'cloudflared'), '#!/bin/sh\n');

  const prevPath = process.env.PATH;
  const prevExplicit = process.env.DSH_POCKET_FROG_CLOUDFLARED;
  const system32 = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
  // PATH 只留 shim + System32：where.exe 能跑，系统里真正的 cloudflared.exe 不可见
  process.env.PATH = `${shimDir};${system32}`;
  delete process.env.DSH_POCKET_FROG_CLOUDFLARED;
  let downloading = false;
  try {
    const bin = await resolveCloudflared({ home, onPhase: (p) => { if (p === 'downloading') downloading = true; } });
    assert.notEqual(bin, 'cloudflared', '不应返回 spawn 不了的裸名（旧实现即此处导致 ENOENT）');
    assert.equal(bin, path.join(binDir, 'cloudflared.exe'), '应命中插件自带二进制: ' + bin);
    assert.equal(downloading, false, '缓存已存在，不应触发下载');
  } finally {
    process.env.PATH = prevPath;
    if (prevExplicit !== undefined) process.env.DSH_POCKET_FROG_CLOUDFLARED = prevExplicit;
    await fsp.rm(home, { recursive: true, force: true });
    await fsp.rm(shimDir, { recursive: true, force: true });
  }
});

test('resolveCloudflared：手动放置的资产名文件也能命中缓存（issue #15）', async () => {
  const fsp = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { resolveCloudflared } = await import('../lib/tunnel.mjs');
  const home = await fsp.mkdtemp(path.join(os.tmpdir(), 'dshp-manual-'));
  const { platform } = await import('node:process');
  const archMap = { x64: 'amd64', arm64: 'arm64' };
  const osName = platform === 'darwin' ? 'darwin' : platform === 'win32' ? 'windows' : 'linux';
  const arch = archMap[process.arch] ?? process.arch;
  const assetName = `cloudflared-${osName}-${arch}${osName === 'windows' ? '.exe' : ''}`;

  // 只放资产名文件（不是 bin 名）→ 应命中，不触发下载
  const binDir = path.join(home, 'dsh-pocket-frog', 'bin');
  await fsp.mkdir(binDir, { recursive: true });
  await fsp.writeFile(path.join(binDir, assetName), 'fake-binary');
  let downloading = false;
  const bin = await resolveCloudflared({ home, onPhase: (p) => { if (p === 'downloading') downloading = true; } });
  assert.equal(downloading, false, '未触发下载');
  assert.ok(bin.includes(assetName), '命中资产名文件: ' + bin);
  await fsp.rm(home, { recursive: true, force: true });
});

test('resolveCloudflared：Linux 上丢弃 Homebrew bottle 坏缓存（issue #22）', async () => {
  const fsp = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { resolveCloudflared } = await import('../lib/tunnel.mjs');
  const home = await fsp.mkdtemp(path.join(os.tmpdir(), 'dshp-homebrew-'));
  const binDir = path.join(home, 'dsh-pocket-frog', 'bin');
  await fsp.mkdir(binDir, { recursive: true });
  // 模拟 Linux Homebrew bottle 坏缓存：文件含 @@HOMEBREW_PREFIX@@ 占位符
  await fsp.writeFile(path.join(binDir, 'cloudflared'), '@@HOMEBREW_PREFIX@@/lib/ld.so\x00fake-binary');
  let downloading = false;
  // 这里只验证「坏缓存不被当成可用二进制」，下载本身无关紧要。
  // 必须把 fetch 打桩：以前这里会真的去 github 拉 17MB，在别的平台（bin 名对不上）
  // 也会走完整下载，撞上 `npm test` 的 --test-timeout=30000 变成随机红。
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('ENETUNREACH: stubbed by test'); };
  try {
    await resolveCloudflared({ home, onPhase: (p) => { if (p === 'downloading') downloading = true; } });
  } catch { /* 下载失败是预期（已被打桩） */ } finally {
    globalThis.fetch = realFetch;
  }
  // 坏缓存应已被删除（不再被当成可用二进制）
  const stillThere = await fsp.readFile(path.join(binDir, 'cloudflared'), 'utf8').catch(() => null);
  // 若系统是 Linux 且触发了下载流程 → 文件被删/被覆盖；macOS 上本测试不适用（无 Homebrew 检查）
  if (process.platform === 'linux') {
    assert.ok(stillThere === null || !stillThere.includes('@@HOMEBREW_PREFIX@@'), '坏缓存被丢弃');
  }
  await fsp.rm(home, { recursive: true, force: true });
});

test('隧道 URL 解析（issue #32）：排除 api.trycloudflare.com 保留子域', async () => {
  const { QUICK_TUNNEL_URL_RE } = await import('../lib/tunnel.mjs');
  // 正常隧道 URL 匹配
  assert.match('https://abc123-def.trycloudflare.com', QUICK_TUNNEL_URL_RE);
  // 保留子域 api 不匹配（扫码打开 api 端点会返回 code 10005 Method Not Allowed）
  assert.doesNotMatch('https://api.trycloudflare.com', QUICK_TUNNEL_URL_RE);
  // cloudflared 输出里 api 地址先出现时，第一个匹配必须是隧道 URL
  const output = 'INF registering tunnel at https://api.trycloudflare.com/...\nYour quick tunnel: https://xyz789.trycloudflare.com\n';
  const m = output.match(QUICK_TUNNEL_URL_RE);
  assert.ok(m && m[0] === 'https://xyz789.trycloudflare.com', '不误匹配 api 地址: ' + (m && m[0]));
});

// ---------- 发布资产名（issue #45） ----------

test('platformAssets（issue #45）：linux 首选裸二进制，不再拼上游已下架的 .tgz', async () => {
  const { platformAssets } = await import('../lib/tunnel.mjs');
  const onPlatform = (platform, arch) => {
    const pd = Object.getOwnPropertyDescriptor(process, 'platform');
    const ad = Object.getOwnPropertyDescriptor(process, 'arch');
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
    Object.defineProperty(process, 'arch', { value: arch, configurable: true });
    try {
      return platformAssets();
    } finally {
      if (pd) Object.defineProperty(process, 'platform', pd);
      if (ad) Object.defineProperty(process, 'arch', ad);
    }
  };
  // 2026-08 起 cloudflared 不再发布 cloudflared-linux-<arch>.tgz（实测 404），
  // 只有裸二进制 cloudflared-linux-<arch>。以前我们在 linux 上拼的是 .tgz，
  // 五个镜像全指向同一个 404 → 必然「所有源都不通」。
  assert.deepEqual(onPlatform('linux', 'x64'), ['cloudflared-linux-amd64', 'cloudflared-linux-amd64.tgz']);
  assert.deepEqual(onPlatform('linux', 'arm64'), ['cloudflared-linux-arm64', 'cloudflared-linux-arm64.tgz']);
  assert.deepEqual(onPlatform('linux', 'ia32'), ['cloudflared-linux-386', 'cloudflared-linux-386.tgz']);
  // .tgz 只作为回退排在后面：首个候选必须是不需要解压的裸二进制
  assert.ok(!onPlatform('linux', 'x64')[0].endsWith('.tgz'), 'linux 首选资产不该是 .tgz');
  // 其他平台的布局没变
  assert.deepEqual(onPlatform('darwin', 'arm64'), ['cloudflared-darwin-arm64.tgz']);
  assert.deepEqual(onPlatform('darwin', 'x64'), ['cloudflared-darwin-amd64.tgz']);
  assert.deepEqual(onPlatform('win32', 'x64'), ['cloudflared-windows-amd64.exe']);
  // 真实环境（本机）至少有一个候选
  assert.ok(platformAssets().length >= 1);
});
