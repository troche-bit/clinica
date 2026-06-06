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
      name: 'consultorio',
      dependencies: ['setup'],
      testMatch: /consultorio\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'paciente',
      dependencies: ['setup'],
      testMatch: /paciente\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'paciente-responsable',
      dependencies: ['setup'],
      testMatch: /paciente-responsable\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'tipo-doc-dig',
      dependencies: ['setup'],
      testMatch: /tipo-doc-dig\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'eventoclinico',
      dependencies: ['setup'],
      testMatch: /eventoclinico\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'especialidad',
      dependencies: ['setup'],
      testMatch: /especialidad\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'horario-prestador',
      dependencies: ['setup'],
      testMatch: /horario-prestador\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'prestador',
      dependencies: ['setup'],
      testMatch: /prestador\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'agenda',
      dependencies: ['setup'],
      testMatch: /agenda\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'consultas',
      dependencies: ['setup'],
      testMatch: /consultas\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'recordatorios',
      dependencies: ['setup'],
      testMatch: /recordatorios\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'timbrado',
      dependencies: ['setup'],
      testMatch: /timbrado\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'grupos-productos',
      dependencies: ['setup'],
      testMatch: /grupos-productos\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'facturacion',
      dependencies: ['setup'],
      testMatch: /facturacion\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'pago-prestador',
      dependencies: ['setup'],
      testMatch: /pago-prestador\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'cobranzas',
      dependencies: ['setup'],
      testMatch: /cobranzas\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'cuentas-mcb',
      dependencies: ['setup'],
      testMatch: /cuentas-mcb\.spec\.js/,
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
