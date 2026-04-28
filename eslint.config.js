const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'public/**',
      'docs/**',
      'reports/**',
      '.github/**'
    ]
  },
  {
    ...js.configs.recommended,
    files: [
      '*.js',
      'server/**/*.js',
      'models/**/*.js',
      'utils/**/*.js',
      'scripts/**/*.js',
      'tests/**/*.js'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-console': 'off'
    }
  }
];
