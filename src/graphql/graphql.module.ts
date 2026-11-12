import { join } from 'node:path';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { Module } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { DateScalar } from './date.scalar.js';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<EnvironmentVariables, true>,
      ): ApolloDriverConfig => {
        const isProduction =
          configService.getOrThrow('NODE_ENV', { infer: true }) ===
          'production';

        return {
          // Development writes the committed schema. Production keeps it in
          // memory: the runtime image has no src/, and a failed write there
          // would stop the process before it listens.
          autoSchemaFile: isProduction
            ? true
            : join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          graphiql: false,
          introspection: true,
          context: ({ req, res }: { req: Request; res: Response }) => ({
            req,
            res,
          }),
          // A browser visit to /graphql sends a GET without Apollo's
          // preflight headers. The embedded Sandbox answers that GET.
          // Form-style POST requests stay blocked by Apollo's CSRF check.
          plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
        };
      },
    }),
  ],
  providers: [DateScalar],
})
export class GraphqlModule {}
