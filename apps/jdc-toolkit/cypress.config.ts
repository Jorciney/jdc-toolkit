import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__dirname),
    setupNodeEvents(on, config) {
      require('@cypress/code-coverage/task')(on, config)
      // include any other plugin code...

      // It's IMPORTANT to return the config object
      // with any changed environment variables
      return config
    },
  },
  reporter: 'junit',
  reporterOptions: {
    mochaFile: './dist/cypress-reports/TEST-[hash].xml',
    rootSuiteTitle: 'Cypress Tests',
    testCaseSwitchClassnameAndName: 'true',
  },
});
