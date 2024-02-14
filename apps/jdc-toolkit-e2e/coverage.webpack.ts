const path = require('path');
export default {
  module: {
    rules: [
      {
        test: /\.(js|ts)$/,
        loader: '@jsdevtools/coverage-istanbul-loader',
        options: { esModules: true, debug: true },
        enforce: 'post',
        include: [
          path.join(__dirname, 'src'),
          path.join(__dirname, '../..', 'apps'),
          path.join(__dirname, '../..', 'libs')

        ],
        exclude: [/\.(spec)\.ts$/, /node_modules/, /(ngfactory|ngstyle)\.js/, /polyfills.ts/],
      },
    ],
  },
};
