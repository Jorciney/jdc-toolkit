import type { Configuration } from 'webpack';

module.exports = {
  entry: {
    content_script: {
      import: 'apps/colorful-review/src/content_script.ts',
      runtime: false,
    },
  },
} as Configuration;
