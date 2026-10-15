import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { PaymentStatus, reasonSchema, type AdminPayment, type Paginated } from '@sakan/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth.decorators.js';
import { requestMeta } from '../common/request-meta.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PaymentsService, type AdminPaymentQuery } from './payments.service.js';

const listQuerySchema = z.object({
  status: z.enum(Object.values(PaymentStatus)).optional(),
  sessionId: z.uuid().optional(),
  q: z.string().max(100).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

@Controller('admin/payments')
@Roles('ADMIN')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listQuerySchema)) query: AdminPaymentQuery): Promise<Paginated<AdminPayment>> {
    return this.payments.adminList(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminPayment> {
    return this.payments.adminGet(id);
  }

  /** Refunds a succeeded payment and voids its entry, while the session is still open or paused. */
  @Post(':id/refund')
  @HttpCode(200)
  refund(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reasonSchema)) body: z.output<typeof reasonSchema>,
    @Req() req: Request,
  ): Promise<AdminPayment> {
    return this.payments.refundByAdmin(admin.id, id, body.reason, requestMeta(req).ipAddress);
  }
}
