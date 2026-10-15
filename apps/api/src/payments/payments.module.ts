import { Module } from '@nestjs/common';
import { PAYMENT_PROVIDER } from './payment-provider.js';
import { StubPaymentProvider } from './stub-payment.provider.js';

@Module({
  providers: [{ provide: PAYMENT_PROVIDER, useClass: StubPaymentProvider }],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}
