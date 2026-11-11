/** Unit tests cover pure logic and the SQLite data layer (run against better-sqlite3 in Node). */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, module: 'commonjs', target: 'es2022', isolatedModules: true, rootDir: '.', types: ['jest', 'node'] } }],
  },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
