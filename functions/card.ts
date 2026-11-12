import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../dist/app.module.js';

let server: Promise<string> | undefined;

function origin(): Promise<string> {
  server ??= (async () => {
    const app: INestApplication = await NestFactory.create(AppModule, {
      logger: ['error', 'warn'],
    });
    app.enableShutdownHooks();
    // The Neon runtime calls fetch(). Nest still serves Express on a local port.
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;
    return `http://127.0.0.1:${port}`;
  })();

  return server;
}

export default async function fetch(request: Request): Promise<Response> {
  const base = await origin();
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.delete('host');
  // A browser address-bar visit often arrives without Accept: text/html.
  // Apollo then treats the GET as a query and rejects it as CSRF.
  if (request.method === 'GET' && !url.searchParams.has('query')) {
    headers.set('accept', 'text/html');
  }
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  return globalThis.fetch(`${base}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? 'half' : undefined,
  } as RequestInit);
}
