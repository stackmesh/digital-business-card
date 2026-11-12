import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import type { EnvironmentVariables } from '../config/env.validation.js';

export const GraphqlModule = GraphQLModule.forRootAsync<ApolloDriverConfig>({
  driver: ApolloDriver,
  inject: [ConfigService],
  useFactory: (
    configService: ConfigService<EnvironmentVariables, true>,
  ): ApolloDriverConfig => {
    const isProduction =
      configService.getOrThrow('NODE_ENV', { infer: true }) === 'production';

    return {
      autoSchemaFile: true,
      sortSchema: true,
      graphiql: false,
      introspection: !isProduction,
      context: ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res,
      }),
      plugins: isProduction
        ? []
        : [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
    };
  },
});
