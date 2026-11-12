import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Kind, type ValueNode } from 'graphql';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

@Scalar('Date')
export class DateScalar implements CustomScalar<string, Date | string> {
  description =
    'Calendar date in YYYY-MM-DD form. Employment dates have no time component.';

  parseValue(value: unknown): string {
    return assertDateOnly(value);
  }

  serialize(value: unknown): string {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new TypeError('Date cannot be serialized');
      }

      return value.toISOString().slice(0, 10);
    }

    return assertDateOnly(value);
  }

  parseLiteral(ast: ValueNode): string {
    if (ast.kind !== Kind.STRING) {
      throw new TypeError('Date must be a string in YYYY-MM-DD form');
    }

    return assertDateOnly(ast.value);
  }
}

function assertDateOnly(value: unknown): string {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) {
    throw new TypeError('Date must be a string in YYYY-MM-DD form');
  }

  return value;
}
