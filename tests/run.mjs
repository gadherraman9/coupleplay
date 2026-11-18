import { build } from 'esbuild';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const files = (await readdir(new URL('.', import.meta.url))).filter(f => f.endsWith('.test.ts'));
if (!files.length) throw new Error('No regression tests found');
const output = await mkdtemp(join(tmpdir(), 'coupleplay-tests-'));
try {
  await build({
    entryPoints: files.map(f => new URL(f, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
    outdir: output, outExtension: { '.js': '.cjs' }, bundle: true, platform: 'node', format: 'cjs',
    jsx: 'automatic', define: { 'import.meta.env': '{}', 'import.meta.glob': '__assetGlob' },
    banner: { js: 'const __assetGlob = () => ({});' },
    loader: { '.jpg':'dataurl', '.png':'dataurl', '.webp':'dataurl', '.svg':'dataurl', '.mp4':'dataurl' },
    logLevel: 'warning',
  });
  const result = spawnSync(process.execPath, ['--test', ...files.map(f => join(output, f.replace('.ts', '.cjs')))], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(output, {recursive:true, force:true});
}
