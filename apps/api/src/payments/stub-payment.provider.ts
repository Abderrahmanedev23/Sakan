import { randomUUID } from 'node:crypto';
import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentProvider,
  VerifiedCallback,
} from './payment-provider.js';

/** Development-only provider. Replace with a real integration (e.g. CMI) before launch. */
@Injectable()
export class StubPaymentProvider implements PaymentProvider {
  readonly name = 'stub';

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const providerTransactionId = `stub_${randomUUID()}`;
    const url = new URL(input.returnUrl);
    url.searchParams.set('ref', input.paymentReference);
    return { redirectUrl: url.toString(), providerTransactionId };
  }

  async verifyCallback(): Promise<VerifiedCallback> {
    throw new NotImplementedException('Stub provider has no callbacks');
  }

  async refund(): Promise<void> {
    throw new NotImplementedException('Stub provider cannot refund');
  }
}
