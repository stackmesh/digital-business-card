import { assertSafeTestDatabase } from './test-database.js';

describe('assertSafeTestDatabase', () => {
  it('rejects a database whose name does not end with _test', () => {
    expect(() =>
      assertSafeTestDatabase(
        'postgresql://business_card:business_card@127.0.0.1:5432/business_card',
      ),
    ).toThrow(/_test/);
  });

  it('accepts the dedicated test database', () => {
    expect(() =>
      assertSafeTestDatabase(
        'postgresql://business_card:business_card@127.0.0.1:5434/business_card_test',
      ),
    ).not.toThrow();
  });
});
