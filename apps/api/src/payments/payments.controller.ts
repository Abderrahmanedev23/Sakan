import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { CheckoutResponse, MyParticipations, PaymentInfo } from '@sakan/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../auth/auth.decorators.js';
import { requestMeta } from '../common/request-meta.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PaymentsService } from './payments.service.js';

const checkoutSchema = z.object({
  /** Alternative to the Idempotency-Key header for clients that can't set headers. */
  idempotencyKey: z.string().min(8).max(100).optional(),
});

const stubCompleteSchema = z.object({ succeeded: z.boolean({ error: 'Say whether the payment succeeded' }) });

@Controller()
@UseGuards(ThrottlerGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * Starts buying one entry. Send a unique `Idempotency-Key` header (e.g. a UUID made when
   * the user taps "Buy"); retrying with the same key returns the same payment.
   */
  @Post('sessions/:id/checkout')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  checkout(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Headers('idempotency-key') headerKey: string | undefined,
    @Body(new ZodValidationPipe(checkoutSchema)) body: z.output<typeof checkoutSchema>,
    @Req() req: Request,
  ): Promise<CheckoutResponse> {
    const key = (headerKey ?? body.idempotencyKey)?.trim();
    if (!key || key.length < 8 || key.length > 100) {
      throw new BadRequestException('Send an Idempotency-Key header of 8 to 100 characters, e.g. a UUID');
    }
    return this.payments.checkout(user.id, sessionId, `${user.id}:${key}`, requestMeta(req).ipAddress);
  }

  @Get('payments/:reference')
  get(@CurrentUser() user: AuthUser, @Param('reference') reference: string): Promise<PaymentInfo> {
    return this.payments.getForUser(user.id, reference);
  }

  /** Development only: confirm or decline a payment made with the stub provider. */
  @Post('payments/:reference/stub-complete')
  @HttpCode(200)
  stubComplete(
    @CurrentUser() user: AuthUser,
    @Param('reference') reference: string,
    @Body(new ZodValidationPipe(stubCompleteSchema)) body: z.output<typeof stubCompleteSchema>,
  ): Promise<PaymentInfo> {
    return this.payments.completeStub(user.id, reference, body.succeeded);
  }

  /** Server-to-server webhook from the payment provider. Authenticated by the provider's signature. */
  @Public()
  @Post('payments/callback/:provider')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  callback(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ) {
    return this.payments.handleCallback(provider, headers, body);
  }

  @Get('me/participations')
  participations(@CurrentUser() user: AuthUser): Promise<MyParticipations> {
    return this.payments.myParticipations(user.id);
  }
}

