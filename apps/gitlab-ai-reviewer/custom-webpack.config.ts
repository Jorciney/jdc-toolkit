import type { Configuration } from 'webpack';

module.exports = {
  entry: {
    background: {
      import: 'apps/gitlab-ai-reviewer/src/background.js',
      runtime: false,
    },
    content: {
      import: 'apps/gitlab-ai-reviewer/src/content.js',
      runtime: false,
    },
    popup: {
      import: 'apps/gitlab-ai-reviewer/src/popup.js',
      runtime: false,
    },
  },
} as Configuration;
