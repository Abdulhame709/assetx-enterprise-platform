module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'ts', 'json'],
  testMatch: ['**/*.spec.ts', '**/*.spec.js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/../src/core/$1',
    '^@application/(.*)$': '<rootDir>/../src/application/$1',
    '^@infrastructure/(.*)$': '<rootDir>/../src/infrastructure/$1',
    '^@api/(.*)$': '<rootDir>/../src/api/$1',
    '^@common/(.*)$': '<rootDir>/../src/common/$1',
  },
  roots: ['<rootDir>'],
  testTimeout: 30000,
};
