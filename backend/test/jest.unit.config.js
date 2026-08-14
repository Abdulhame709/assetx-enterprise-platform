const base = require('./jest.config');

module.exports = {
  ...base,
  testMatch: ['**/*.unit.spec.ts', '**/*.unit.spec.js'],
};
