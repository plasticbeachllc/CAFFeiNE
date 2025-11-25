import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const newE2E = process.env.TEST_MODE === 'e2e';
const newE2ETests = './src/__tests__/e2e/**/*.spec.ts';

// Use minimal prelude for parser tests (no app dependencies)
const isParserTest = process.argv.some(arg => arg.includes('markdown-parser'));
const preludes = isParserTest
  ? [
      pathToFileURL(
        resolve(__dirname, 'src/__tests__/markdown-parser/prelude.ts')
      ).href,
    ]
  : [pathToFileURL(resolve(__dirname, 'src/prelude.ts')).href];

if (newE2E) {
  preludes.push(
    pathToFileURL(resolve(__dirname, 'src/__tests__/e2e/prelude.ts')).href
  );
}

export default {
  timeout: '1m',
  extensions: {
    ts: 'module',
  },
  watchMode: {
    ignoreChanges: ['**/*.gen.*'],
  },
  files: newE2E
    ? [newE2ETests]
    : ['**/*.spec.ts', '**/*.e2e.ts', '!' + newE2ETests],
  require: preludes,
  environmentVariables: {
    NODE_ENV: 'test',
    DEPLOYMENT_TYPE: 'affine',
    MAILER_HOST: '0.0.0.0',
    MAILER_PORT: '1025',
    MAILER_USER: 'noreply@toeverything.info',
    MAILER_PASSWORD: 'affine',
    MAILER_SENDER: 'noreply@toeverything.info',
  },
};
