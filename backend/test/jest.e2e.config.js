const base = require('./jest.config');

module.exports = {
  ...base,
  testMatch: ['**/*.e2e.spec.ts', '**/*.e2e.spec.js'],
  // Each e2e suite boots a full in-memory database, which is slow on small CI runners.
  testTimeout: 60000,
};
