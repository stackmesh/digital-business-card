import { DateScalar } from './date.scalar.js';

describe('DateScalar', () => {
  const scalar = new DateScalar();

  it('serializes a UTC calendar date', () => {
    expect(scalar.serialize(new Date('2020-03-01T00:00:00.000Z'))).toBe(
      '2020-03-01',
    );
  });

  it('rejects values that are not calendar dates', () => {
    expect(() => scalar.serialize('March 1, 2020')).toThrow(/YYYY-MM-DD/);
    expect(() => scalar.parseValue('2020-3-01')).toThrow(/YYYY-MM-DD/);
  });
});
