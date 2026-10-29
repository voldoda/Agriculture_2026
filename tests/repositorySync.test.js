import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publishRepositories } from '../scripts/publish-repositories.mjs';

test('publishing synchronizes two repositories and tags, then blocks a divergent second repository before changing the first', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'agriculture-sync-'));
  const git = process.env.GIT_EXECUTABLE || 'git';
  const run = (cwd, ...args) => execFileSync(git, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const primary = path.join(dir, 'primary.git');
  const secondary = path.join(dir, 'secondary.git');
  const work = path.join(dir, 'work');
  try {
    run(dir, 'init', '--bare', '--initial-branch=main', primary);
    run(dir, 'init', '--bare', '--initial-branch=main', secondary);
    run(dir, 'init', '--initial-branch=main', work);
    run(work, 'config', 'user.name', 'Repository sync test');
    run(work, 'config', 'user.email', 'sync@example.invalid');
    writeFileSync(path.join(work, 'README.md'), 'initial\n');
    run(work, 'add', 'README.md');
    run(work, 'commit', '-m', 'initial');
    run(work, 'tag', '-a', 'v1.0.0', '-m', 'initial version');
    run(work, 'remote', 'add', 'origin', primary);
    run(work, 'remote', 'set-url', '--add', '--push', 'origin', primary);
    run(work, 'remote', 'set-url', '--add', '--push', 'origin', secondary);
    const options = { cwd: work, git, expected: [primary, secondary], log: () => {} };
    publishRepositories({ ...options, dryRun: true });
    assert.equal(run(primary, 'for-each-ref'), '');
    assert.equal(run(secondary, 'for-each-ref'), '');
    const initial = publishRepositories(options).head;
    assert.equal(run(primary, 'rev-parse', 'main'), initial);
    assert.equal(run(secondary, 'rev-parse', 'main'), initial);
    assert.equal(run(primary, 'rev-parse', 'v1.0.0'), run(secondary, 'rev-parse', 'v1.0.0'));

    writeFileSync(path.join(work, 'README.md'), 'dirty\n');
    assert.throws(() => publishRepositories(options), /local changes/);
    run(work, 'add', 'README.md');
    run(work, 'commit', '-m', 'local update');
    run(work, 'config', '--unset-all', 'remote.origin.pushurl');
    run(work, 'remote', 'set-url', '--add', '--push', 'origin', primary);
    assert.throws(() => publishRepositories(options), /push URLs/);
    run(work, 'remote', 'set-url', '--add', '--push', 'origin', secondary);

    const other = path.join(dir, 'other');
    run(dir, 'clone', secondary, other);
    run(other, 'config', 'user.name', 'Repository sync test');
    run(other, 'config', 'user.email', 'sync@example.invalid');
    writeFileSync(path.join(other, 'remote.txt'), 'independent change\n');
    run(other, 'add', 'remote.txt');
    run(other, 'commit', '-m', 'independent secondary change');
    run(other, 'push', 'origin', 'main');
    assert.throws(() => publishRepositories(options), /Repository 2 has changes/);
    assert.equal(run(primary, 'rev-parse', 'main'), initial, 'primary was not advanced before detecting divergence');
    run(work, 'fetch', secondary, 'main');
    run(work, 'merge', '--no-edit', 'FETCH_HEAD');
    const merged = publishRepositories(options).head;
    assert.equal(run(primary, 'rev-parse', 'main'), merged);
    assert.equal(run(secondary, 'rev-parse', 'main'), merged);
  } finally {
    const resolved = realpathSync(dir);
    assert.ok(resolved.startsWith(realpathSync(tmpdir()) + path.sep));
    assert.ok(path.basename(resolved).startsWith('agriculture-sync-'));
    rmSync(resolved, { recursive: true, force: true });
  }
});
