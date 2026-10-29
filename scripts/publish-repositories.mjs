import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPOSITORIES = [
  'https://github.com/WeSmart-co-op/Agriculture.git',
  'https://github.com/voldoda/Agriculture_2026.git',
];

function identity(value) {
  try {
    const url = new URL(value);
    if (url.password) throw new Error('Do not store tokens or passwords in remote URLs.');
    if (url.protocol === 'file:') return path.resolve(fileURLToPath(url));
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\.git\/?$/, '').replace(/\/$/, '').toLowerCase();
  } catch (error) {
    if (/^[a-z]+:\/\//i.test(value)) throw error;
    return path.resolve(value);
  }
}

export function publishRepositories({
  cwd = fileURLToPath(new URL('../', import.meta.url)),
  git = process.env.GIT_EXECUTABLE || 'git',
  expected = REPOSITORIES,
  dryRun = false,
  log = console.log,
} = {}) {
  const command = args => execFileSync(git, args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
  }).trim();
  const ancestor = ref => {
    try { command(['merge-base', '--is-ancestor', ref, 'HEAD']); return true; }
    catch (error) { if (error.status === 1) return false; throw error; }
  };
  if (command(['symbolic-ref', '--short', 'HEAD']) !== 'main') throw new Error('Switch to main before publishing.');
  if (command(['status', '--porcelain'])) throw new Error('Commit or preserve local changes before publishing.');
  const fetchUrl = command(['remote', 'get-url', 'origin']);
  if (identity(fetchUrl) !== identity(expected[0])) throw new Error('origin must fetch from the primary repository.');
  const urls = command(['remote', 'get-url', '--push', '--all', 'origin']).split(/\r?\n/).filter(Boolean);
  if (urls.length !== 2 || expected.length !== 2 || urls.some((url, i) => identity(url) !== identity(expected[i]))) {
    throw new Error('origin must have the primary and secondary push URLs in that order; see docs/REPOSITORY_SYNC.md.');
  }
  const head = command(['rev-parse', 'HEAD']);
  const tags = command(['for-each-ref', '--format=%(refname) %(objectname) %(objecttype)', 'refs/tags'])
    .split(/\r?\n/).filter(Boolean).map(row => row.split(' '))
    .filter(([ref, , type]) => type === 'tag' && ancestor(`${ref}^{}`))
    .map(([ref, sha]) => ({ ref, sha }));
  // Finish both preflights before changing either remote.
  for (let i = 0; i < urls.length; i++) {
    const refs = new Map(command(['ls-remote', '--heads', '--tags', urls[i]])
      .split(/\r?\n/).filter(Boolean).map(row => { const [sha, ref] = row.split(/\s+/); return [ref, sha]; }));
    const remoteHead = refs.get('refs/heads/main');
    if (remoteHead) {
      command(['fetch', '--no-tags', urls[i], 'refs/heads/main']);
      if (!ancestor(remoteHead)) throw new Error(`Repository ${i + 1} has changes outside this main. Merge them, using the primary source for conflicts, before publishing.`);
    }
    for (const tag of tags) {
      if (refs.has(tag.ref) && refs.get(tag.ref) !== tag.sha) throw new Error(`Repository ${i + 1} has a different ${tag.ref}; existing tags will not be replaced.`);
    }
  }
  const refspecs = ['HEAD:refs/heads/main', ...tags.map(tag => `${tag.ref}:${tag.ref}`)];
  for (let i = 0; i < urls.length; i++) {
    log(`${dryRun ? 'Check' : 'Publish'} repository ${i + 1} / ${urls.length}: ${head}`);
    command(['push', '--atomic', ...(dryRun ? ['--dry-run'] : []), urls[i], ...refspecs]);
  }
  if (!dryRun) {
    for (let i = 0; i < urls.length; i++) {
      const refs = new Map(command(['ls-remote', urls[i], 'refs/heads/main', ...tags.map(tag => tag.ref)])
        .split(/\r?\n/).filter(Boolean).map(row => { const [sha, ref] = row.split(/\s+/); return [ref, sha]; }));
      if (refs.get('refs/heads/main') !== head || tags.some(tag => refs.get(tag.ref) !== tag.sha)) {
        throw new Error(`Repository ${i + 1} could not be verified. Inspect both remote refs before retrying.`);
      }
    }
    command(['fetch', '--no-tags', 'origin', 'main']);
  }
  log(dryRun ? 'Both repository preflights passed; no remote changes made.' : 'Both repositories have the same main and reachable annotated tags.');
  return { head, tags: tags.map(tag => tag.ref), repositories: expected, dryRun };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--dry-run')) {
    console.error('Usage: npm run publish:repos -- [--dry-run]');
    process.exitCode = 1;
  } else {
    try { publishRepositories({ dryRun: args.includes('--dry-run') }); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
