import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Testy czekają na czas symulacji (helpers.ts), który na wolnym GPU płynie wolniej.
  timeout: 120_000,
  // Ładowanie sceny z modelami .glb na SwiftShader potrafi przekroczyć domyślne 5 s.
  expect: { timeout: 30_000 },
  // Jeden wzorzec dla wszystkich systemów: WebGL renderuje programowo SwiftShader.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--use-gl=angle',
      ],
    },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
