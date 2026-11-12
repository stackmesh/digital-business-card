import { Injectable } from '@nestjs/common';

export interface HealthReport {
  status: 'ok';
}

@Injectable()
export class HealthService {
  getStatus(): HealthReport {
    return { status: 'ok' };
  }
}
