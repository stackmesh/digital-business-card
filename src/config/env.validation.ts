export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export interface EnvironmentVariables {
  NODE_ENV: NodeEnvironment;
  PORT: number;
  DATABASE_URL: string;
}

function isNodeEnvironment(value: unknown): value is NodeEnvironment {
  return (
    typeof value === 'string' &&
    (NODE_ENVIRONMENTS as readonly string[]).includes(value)
  );
}

function readPort(value: unknown): number {
  if (value === undefined) {
    return 3000;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value);
  }

  return Number.NaN;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];
  const nodeEnvInput =
    config.NODE_ENV === undefined ? 'development' : config.NODE_ENV;

  if (!isNodeEnvironment(nodeEnvInput)) {
    errors.push('NODE_ENV must be one of: development, test, production');
  }

  const port = readPort(config.PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT must be an integer between 1 and 65535');
  }

  const databaseUrl = config.DATABASE_URL;

  if (typeof databaseUrl !== 'string' || databaseUrl.trim() === '') {
    errors.push('DATABASE_URL is required');
  } else {
    try {
      const url = new URL(databaseUrl);

      if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
        errors.push('DATABASE_URL must use the postgresql:// scheme');
      }
    } catch {
      errors.push('DATABASE_URL must be a valid URL');
    }
  }

  if (errors.length > 0 || !isNodeEnvironment(nodeEnvInput)) {
    throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
  }

  if (typeof databaseUrl !== 'string') {
    throw new Error('Invalid environment:\n- DATABASE_URL is required');
  }

  return {
    ...config,
    NODE_ENV: nodeEnvInput,
    PORT: port,
    DATABASE_URL: databaseUrl,
  };
}
