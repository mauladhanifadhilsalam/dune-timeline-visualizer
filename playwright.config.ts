import { defineConfig } from '@playwright/test';

/**
 * Browser tests against the production build, served by `vite preview`. WebGL runs on SwiftShader,
 * the software renderer, so they need no GPU: slow, but the same pixels on a laptop and in CI.
 */
export default defineConfig({
  testDir: 'e2e',
  // Software WebGL: one browser at a time keeps each test's frame budget predictable.
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173/',
    colorScheme: 'dark',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
  },
});
