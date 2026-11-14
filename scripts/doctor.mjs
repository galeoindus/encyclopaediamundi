#!/usr/bin/env node
/**
 * Veridell — one command that answers "is this tree still well?"
 *
 * The checks already exist; they were scattered across five npm scripts and two
 * workflows, so nobody ran all of them. This runs them in the order that fails
 * fastest — a module that does not parse is worth knowing before a 45-second
 * test suite starts — and prints one verdict.
 *
 *   node scripts/doctor.mjs          the fast pass (about 35 seconds)
 *   node scripts/doctor.mjs --full   the fast pass, then the test suite
 *
 * Exit code 1 if any step failed. Warnings never fail the run: a warning is
 * drift worth reading, not a broken build.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const full = process.argv.includes('--full');

const STEPS = [
  {
    name: 'modules',
    what: 'every module parses and every named import resolves',
    args: ['scripts/check.mjs'],
  },
  {
    name: 'pages',
    what: 'every page\'s local assets exist and share one build id',
    args: ['scripts/audit-site.mjs'],
  },
  {
    name: 'deep',
    what: 'every file is internally consistent — ids, links, meta, secrets',
    args: ['scripts/deep-audit.mjs'],
  },
  {
    name: 'drift',
    what: 'nothing has fallen out of the sitemap, the index or a link',
    args: ['scripts/weekly-audit.mjs'],
  },
];

if (full) {
  STEPS.push({
    name: 'tests',
    what: 'the suite — 270 assertions over the behaviour that shipped',
    args: ['--test'],
    node: true,
  });
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const results = [];

console.log(`Veridell ${pkg.version} — doctor${full ? ' (full)' : ''}\n`);

for (const step of STEPS) {
  const started = process.hrtime.bigint();
  const run = spawnSync(
    process.execPath,
    step.node ? step.args : step.args,
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  const ok = run.status === 0;
  results.push({ ...step, ok, ms, out: `${run.stdout || ''}${run.stderr || ''}` });

  const mark = ok ? 'ok  ' : 'FAIL';
  console.log(`  ${mark}  ${step.name.padEnd(8)} ${String(Math.round(ms)).padStart(5)} ms  ${step.what}`);
  if (!ok) {
    for (const line of (run.stdout || run.stderr || '').trim().split('\n').slice(0, 12)) {
      console.log(`          ${line}`);
    }
  }
}

const failed = results.filter((r) => !r.ok);
const total = Math.round(results.reduce((sum, r) => sum + r.ms, 0));

console.log('');
if (failed.length) {
  console.log(`${failed.length} of ${results.length} checks failed — ${total} ms`);
  console.log(`Start with: ${failed[0].name}`);
  process.exit(1);
}
console.log(`all ${results.length} checks passed — ${total} ms`);
