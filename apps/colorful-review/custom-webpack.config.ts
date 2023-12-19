import type { Configuration } from 'webpack';

module.exports = {
  entry: {
    background: {
      import: 'apps/colorful-review/src/background.ts',
      runtime: false,
    },
    content_script: {
      import: 'apps/colorful-review/src/content_script.ts',
      runtime: false,
    },
  },
} as Configuration;
