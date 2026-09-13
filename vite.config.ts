import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages serves a project site at /<repo name>/, so the base path
// follows the repo: the Actions build reads it from GITHUB_REPOSITORY, and a
// local build falls back to the package name (keep it equal to the repo name).
declare const process: { env: Record<string, string | undefined> };   // no @types/node here
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] || process.env.npm_package_name || 'golf';

export default defineConfig({
  base: `/${repo}/`,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
