import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = [];
for (const dir of ['lib', 'scripts', 'test']) {
  if (!fs.existsSync(path.join(root, dir))) continue;
  for (const entry of fs.readdirSync(path.join(root, dir), { recursive: true })) if (/\.(?:mjs|js)$/u.test(entry)) files.push(path.join(dir, entry));
}
files.push('client.js');
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
let registration;
new vm.Script(fs.readFileSync(path.join(root, 'lib/client.js'), 'utf8')).runInNewContext({ window: { __ModuleLoader__: { load(value) { registration = value; } } } });
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (registration?.id !== manifest.name || typeof registration.factory !== 'function') throw new Error('Client module registration is invalid');
if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('Bundle patch is missing');
for (const [name, version] of Object.entries(manifest.peerDependencies)) if (name.startsWith('@deepseek-ai/dsh-') && version !== '0.2.0-rc.2') throw new Error(`Unexpected DSH peer range: ${name}`);
console.log(`Checked ${files.length} JavaScript files and DSH bundle/client metadata`);
