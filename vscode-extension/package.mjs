#!/usr/bin/env node
/**
 * Interactive packaging script for the Diagram Studio VS Code extension.
 *
 * Steps:
 *   1. Prompt for version bump (patch / minor / major)
 *   2. Bump version in package.json (no git tag)
 *   3. Build (SvelteKit + extension host)
 *   4. Package with vsce → .vsix
 *   5. Install in VS Code and Cursor
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function run(cmd, opts = {}) {
  execSync(cmd, { cwd: __dirname, stdio: 'inherit', ...opts });
}

function tryRun(cmd, label) {
  try {
    run(cmd);
  } catch {
    console.log(`[package] ${label} — skipped (CLI not found)`);
  }
}

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));
console.log(`\nDiagram Studio VS Code Extension`);
console.log(`Current version: ${pkg.version}\n`);

const input = await ask('Bump type — patch / minor / major [patch]: ');
const bump = input || 'patch';

if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error(`Invalid bump type "${bump}". Use patch, minor, or major.`);
  process.exit(1);
}

console.log(`\n[package] Bumping ${bump} version...`);
run(`npm version ${bump} --no-git-tag-version`);

const newPkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));
const vsix = `${newPkg.name}-${newPkg.version}.vsix`;
console.log(`[package] New version: ${newPkg.version}`);

console.log('\n[package] Building...');
run('node build.mjs');

console.log('\n[package] Packaging VSIX...');
run('npx @vscode/vsce package --no-dependencies');

console.log('\n[package] Installing in VS Code...');
tryRun(`code --install-extension ${vsix} --force`, 'VS Code');

console.log('[package] Installing in Cursor...');
tryRun(`cursor --install-extension ${vsix} --force`, 'Cursor');

console.log(`\n[package] Done! v${newPkg.version} → ${vsix}\n`);
