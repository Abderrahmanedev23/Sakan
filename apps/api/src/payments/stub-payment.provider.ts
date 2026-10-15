import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentProvider,
  VerifiedCallback,
} from './payment-provider.js';

export interface StubCallbackBody {
  paymentReference: string;
  providerTransactionId: string;
  succeeded: boolean;
}

/**
 * Development-only provider: no money moves. Checkout sends the user to the web app's
 * payment page, where a "simulated payment" panel confirms or declines it. Callbacks are
 * signed with PAYMENT_STUB_SECRET like a real provider's would be, so the same confirmation
 * path is exercised. Replace with a real integration (e.g. CMI) before launch.
 */
@Injectable()
export class StubPaymentProvider implements PaymentProvider {
  readonly name = 'stub';
  private readonly logger = new Logger(StubPaymentProvider.name);
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.get<string>('PAYMENT_STUB_SECRET') || 'sakan-dev-stub-secret';
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const providerTransactionId = `stub_${randomUUID()}`;
    const url = new URL(input.returnUrl);
    url.searchParams.set('stub', '1');
    return { redirectUrl: url.toString(), providerTransactionId };
  }

  sign(body: StubCallbackBody): string {
    return createHmac('sha256', this.secret).update(JSON.stringify(body)).digest('hex');
  }

  async verifyCallback(headers: Record<string, string | string[] | undefined>, body: unknown): Promise<VerifiedCallback> {
    const parsed = body as Partial<StubCallbackBody>;
    if (typeof parsed?.paymentReference !== 'string' || typeof parsed.providerTransactionId !== 'string' || typeof parsed.succeeded !== 'boolean') {
      throw new UnauthorizedException('Malformed callback');
    }
    const canonical: StubCallbackBody = {
      paymentReference: parsed.paymentReference,
      providerTransactionId: parsed.providerTransactionId,
      succeeded: parsed.succeeded,
    };
    const given = Buffer.from(String(headers['x-stub-signature'] ?? ''), 'hex');
    const expected = Buffer.from(this.sign(canonical), 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException('Invalid callback signature');
    }
    return {
      ...canonical,
      failureReason: canonical.succeeded ? undefined : 'Declined (simulated)',
      rawPayload: canonical,
    };
  }

  async refund(providerTransactionId: string, amountCents: number): Promise<void> {
    this.logger.log(`Simulated refund of ${amountCents} centimes for ${providerTransactionId}`);
  }
}
