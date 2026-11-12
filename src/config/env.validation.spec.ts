import { validateEnvironment } from './env.validation.js';

const validConfig = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL:
    'postgresql://business_card:business_card@localhost:5432/business_card?schema=public',
};

describe('validateEnvironment', () => {
  it('applies defaults and coerces PORT', () => {
    const config = validateEnvironment({
      DATABASE_URL: validConfig.DATABASE_URL,
    });

    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
    expect(config.DATABASE_URL).toBe(validConfig.DATABASE_URL);
  });

  it('accepts postgres and postgresql schemes', () => {
    expect(
      validateEnvironment({
        ...validConfig,
        DATABASE_URL:
          'postgres://business_card:business_card@localhost:5432/db',
      }).DATABASE_URL,
    ).toContain('postgres://');
  });

  it('rejects a missing database url, a bad port, and an unknown environment', () => {
    expect(() => validateEnvironment({})).toThrow(/DATABASE_URL is required/);
    expect(() => validateEnvironment({ ...validConfig, PORT: '0' })).toThrow(
      /PORT must be an integer/,
    );
    expect(() =>
      validateEnvironment({ ...validConfig, NODE_ENV: 'staging' }),
    ).toThrow(/NODE_ENV must be one of/);
    expect(() =>
      validateEnvironment({
        ...validConfig,
        DATABASE_URL: 'mysql://localhost/db',
      }),
    ).toThrow(/postgresql:\/\//);
  });
});
