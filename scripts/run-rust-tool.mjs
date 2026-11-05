import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const commands = {
  build: ['build', '--locked', '--release', '--bins'],
  test: ['test', '--locked', '--workspace'],
  docs: ['run', '--locked', '--release', '--bin', 'build-demo-docs', '--'],
  sample: ['run', '--locked', '--release', '--bin', 'process-sample-data', '--'],
};
const [operation, ...args] = process.argv.slice(2);
if (!Object.hasOwn(commands, operation)) {
  console.error('Choose a Rust tool: build, test, docs or sample.');
  process.exit(1);
}
const installed = path.join(homedir(), '.cargo', 'bin', process.platform === 'win32' ? 'cargo.exe' : 'cargo');
const cargo = process.env.CARGO || (existsSync(installed) ? installed : 'cargo');
const result = spawnSync(cargo, [...commands[operation], ...args], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit', shell: false,
});
if (result.error) console.error(`Rust/Cargo is required for this optional tool: ${result.error.message}. See docs/RUST_TOOLS.md.`);
process.exit(result.status ?? 1);
