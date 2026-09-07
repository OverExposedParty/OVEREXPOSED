const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const entryDirectory = path.join(__dirname, 'oling-clash-entries');
const outdir = path.join(root, 'public', 'build', 'olings', 'clash');

async function build() {
  await esbuild.build({
    bundle: true,
    entryPoints: {
      'clash-core': path.join(entryDirectory, 'core.js'),
      'clash-inspector': path.join(entryDirectory, 'inspector.js'),
      'clash-lobby': path.join(entryDirectory, 'lobby.js'),
      'clash-lobby-online': path.join(entryDirectory, 'lobby-online.js'),
      'clash-online': path.join(entryDirectory, 'online.js'),
      'clash-tutorial': path.join(entryDirectory, 'tutorial.js')
    },
    outdir,
    minify: true,
    sourcemap: false,
    platform: 'browser',
    format: 'iife'
  });

  await esbuild.build({
    entryPoints: [path.join(root, 'public/css/olings/clash/clash.css')],
    outfile: path.join(outdir, 'clash.css'),
    minify: true,
    sourcemap: false
  });
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
