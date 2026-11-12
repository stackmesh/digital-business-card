import { Controller, Get } from '@nestjs/common';
import { HealthService, type HealthReport } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): HealthReport {
    return this.healthService.getStatus();
  }
}
