import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// Run the real build script against a full isolated source copy using each Git
// line-ending mode. Windows checkouts must emit the same ModuleLoader factory.
test('client builds identically from LF and Windows CRLF checkouts', t => {
  const tempRoot = realpathSync(tmpdir());
  const fixture = mkdtempSync(path.join(tempRoot, 'codex-client-build-'));
  t.after(() => {
    const resolved = realpathSync(fixture);
    assert.equal(path.dirname(resolved), tempRoot);
    assert.ok(path.basename(resolved).startsWith('codex-client-build-'));
    rmSync(resolved, { recursive: true });
  });
  mkdirSync(path.join(fixture, 'scripts'));
  writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ name: 'dsh-web-search-codex-020', type: 'module' }));
  writeFileSync(path.join(fixture, 'scripts/build-client.mjs'), readFileSync(new URL('../scripts/build-client.mjs', import.meta.url)));
  const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
  const builds = [];
  for (const newline of ['\n', '\r\n']) {
    writeFileSync(path.join(fixture, 'client.js'), source.replace(/\n/g, newline));
    const result = spawnSync(process.execPath, [path.join(fixture, 'scripts/build-client.mjs')], { stdio: 'inherit' });
    assert.equal(result.status, 0, `Build succeeds with ${JSON.stringify(newline)} line endings`);
    builds.push(readFileSync(path.join(fixture, 'lib/client.js'), 'utf8'));
  }
  assert.equal(builds[0], builds[1]);
  assert.equal(builds[0], readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'));
});
