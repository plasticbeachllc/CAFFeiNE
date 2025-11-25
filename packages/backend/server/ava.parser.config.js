// Minimal AVA config for markdown parser tests only
// Skips preludes to avoid AVA module resolution bug
export default {
  timeout: '1m',
  extensions: {
    ts: 'module',
  },
  files: ['src/core/markdown-parser/**/*.spec.ts'],
  // Skip preludes for parser tests - they don't need DB/app setup
  require: [],
  environmentVariables: {
    NODE_ENV: 'test',
  },
};
