const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  globalSetup: './e2e/global-setup.js',
  reporter: [
    ['list'],
    ['json', { outputFile: '../tests/logs/usuarios_e2e.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    screenshotsDir: '../tests/screenshots',
    trace: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },
    {
      name: 'usuarios',
      dependencies: ['setup'],
      testMatch: /usuarios\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'login',
      testMatch: /login\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'ubicacion',
      dependencies: ['setup'],
      testMatch: /ubicacion\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'screenshots-manual',
      dependencies: ['setup'],
      testMatch: /screenshots-.*\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
})
