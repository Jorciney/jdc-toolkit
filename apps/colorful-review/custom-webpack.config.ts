import type { Configuration } from 'webpack';

module.exports = {
  entry: { background: { import: 'apps/colorful-review/src/background.ts', runtime: false } }
} as Configuration;
