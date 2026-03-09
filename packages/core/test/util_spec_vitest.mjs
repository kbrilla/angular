import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const vitestEntrypoint = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const configPath = fileURLToPath(new URL('./util_spec_vitest.config.mjs', import.meta.url));

const result = spawnSync(
  process.execPath,
  [vitestEntrypoint, 'run', '--config', configPath, '--root', repoRoot],
  {
    stdio: 'inherit',
  },
);

process.exit(result.status ?? 1);
