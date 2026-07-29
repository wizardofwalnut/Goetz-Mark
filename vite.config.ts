import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Two build shapes from one config.
 *
 * The normal build is the game: `index.html`, minified, as small as it goes.
 *
 * `--mode standalone` builds the handoff page instead — the one-file playtest
 * build that tools/make-standalone.mjs inlines and that gets handed to a chat
 * assistant for tuning. That one is deliberately NOT minified: the whole point
 * is that someone can open it, find `resolveConquest` or `bakeCounty`, and
 * change them. A minified bundle runs perfectly and is useless for that.
 *
 * Keeping both shapes in ONE config rather than a second config file means the
 * game and the handoff can never be built with different aliases or plugins —
 * which is exactly the drift that makes a playtest build stop matching the
 * game it is supposed to represent.
 */
export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone';
  const entry = (name: string) =>
    fileURLToPath(new URL(`./${name}`, import.meta.url));

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5173,
    },
    build: {
      // Never overwrite the real build with the readable one.
      outDir: standalone ? 'dist-standalone' : 'dist',
      // Only ever OVERRIDE minification, never restate the default. Naming a
      // minifier here (`'esbuild'`) broke the production build outright: Vite 8
      // minifies with oxc and esbuild is not installed, so spelling out what
      // was already happening introduced a dependency that does not exist.
      ...(standalone ? { minify: false as const } : {}),
      rollupOptions: {
        input: standalone ? entry('standalone.html') : entry('index.html'),
        // One chunk, so the handoff genuinely is one file with nothing left to
        // resolve at runtime.
        ...(standalone ? { codeSplitting: false } : {}),
      },
    },
  };
});
