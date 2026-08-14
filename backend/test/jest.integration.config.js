const base = require('./jest.config');

module.exports = {
  ...base,
  testMatch: ['**/*.integration.spec.ts', '**/*.integration.spec.js'],
};
