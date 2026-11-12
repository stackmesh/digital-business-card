import { Query, Resolver } from '@nestjs/graphql';
import { HealthReportModel } from './health.model.js';
import { HealthService } from './health.service.js';

@Resolver(() => HealthReportModel)
export class HealthResolver {
  constructor(private readonly healthService: HealthService) {}

  @Query(() => HealthReportModel, {
    description: 'Reports whether the API process is running.',
  })
  health(): HealthReportModel {
    return this.healthService.getStatus();
  }
}
