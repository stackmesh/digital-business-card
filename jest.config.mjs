const shared = {
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  testEnvironment: 'node',
};

export default {
  projects: [
    {
      ...shared,
      displayName: 'unit',
      testMatch: [
        '<rootDir>/src/**/*.spec.ts',
        '<rootDir>/test/**/*.unit.spec.ts',
      ],
    },
    {
      ...shared,
      displayName: 'integration',
      testMatch: ['<rootDir>/test/**/*.integration-spec.ts'],
      testTimeout: 60_000,
    },
    {
      ...shared,
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
      testTimeout: 30_000,
    },
  ],
};
