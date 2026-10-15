import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@sakan/shared';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() };
  }
}
