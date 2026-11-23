import { spawnSync } from 'node:child_process';
import {
  readFileSync,
  appendFileSync,
  mkdtempSync,
  copyFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
  existsSync,
  openSync,
  closeSync,
} from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, delimiter } from 'node:path';

const root = resolve('.');
const out = join(root, 'src/wasm/neoryder-sim');
const stage = mkdtempSync(join(tmpdir(), 'neoryder-wasm-'));
const env = {
  ...process.env,
  CARGO_HOME: join(root, '.cargo-home'),
  WASM_PACK_CACHE: join(root, '.wasm-pack-cache'),
};
const pathKey =
  Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
env[pathKey] = [env[pathKey], join(homedir(), '.cargo/bin')].join(delimiter);
try {
  const built = spawnSync(
    'wasm-pack',
    [
      'build',
      'rust/neoryder-sim',
      '--target',
      'web',
      '--release',
      '--out-dir',
      stage,
    ],
    { env, stdio: 'inherit' },
  );
  if (built.error) throw built.error;
  if (built.status !== 0) {
    // Restricted Windows hosts can run Cargo directly while wasm-pack's metadata subprocess fails.
    const caches = [env.WASM_PACK_CACHE];
    if (env.LOCALAPPDATA) caches.push(join(env.LOCALAPPDATA, '.wasm-pack'));
    const cli = caches
      .filter(existsSync)
      .flatMap((cache) =>
        readdirSync(cache)
          .filter((name) => name.startsWith('wasm-bindgen-'))
          .map((name) =>
            join(
              cache,
              name,
              process.platform === 'win32'
                ? 'wasm-bindgen.exe'
                : 'wasm-bindgen',
            ),
          ),
      )
      .find((path) => {
        if (!existsSync(path)) return false;
        const versionFile = join(stage, 'version.txt');
        const fd = openSync(versionFile, 'w');
        try {
          const result = spawnSync(path, ['--version'], {
            stdio: ['ignore', fd, 'inherit'],
          });
          return (
            result.status === 0 &&
            readFileSync(versionFile, 'utf8').trim() === 'wasm-bindgen 0.2.130'
          );
        } finally {
          closeSync(fd);
        }
      });
    if (!cli) throw new Error('wasm-pack: ' + built.status);
    const run = (cmd, args) => {
      const result = spawnSync(cmd, args, { env, stdio: 'inherit' });
      if (result.error || result.status !== 0)
        throw result.error ?? new Error(cmd + ': ' + result.status);
    };
    run('cargo', [
      'build',
      '--locked',
      '--release',
      '--target',
      'wasm32-unknown-unknown',
      '--manifest-path',
      'rust/Cargo.toml',
    ]);
    run(cli, [
      '--target',
      'web',
      '--out-dir',
      stage,
      'rust/target/wasm32-unknown-unknown/release/neoryder_sim.wasm',
    ]);
  }
  mkdirSync(out, { recursive: true });
  for (const suffix of ['.js', '.d.ts', '_bg.wasm', '_bg.wasm.d.ts']) {
    const name = 'neoryder_sim' + suffix;
    copyFileSync(join(stage, name), join(out, name));
  }
  const bytes = readFileSync(join(stage, 'neoryder_sim_bg.wasm')).toString(
    'base64',
  );
  appendFileSync(
    join(out, 'neoryder_sim.js'),
    '\nexport const binary = "' + bytes + '";\n',
  );
  appendFileSync(
    join(out, 'neoryder_sim.d.ts'),
    '\nexport const binary: string;\n',
  );
} finally {
  rmSync(stage, { recursive: true, force: true });
}
