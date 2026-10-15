import { Module } from '@nestjs/common';
import { DrawsModule } from '../draws/draws.module.js';
import { AdminPaymentsController } from './admin-payments.controller.js';
import { PAYMENT_PROVIDER } from './payment-provider.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { StubPaymentProvider } from './stub-payment.provider.js';

@Module({
  imports: [DrawsModule],
  controllers: [PaymentsController, AdminPaymentsController],
  // Only the development stub exists today; a real provider (e.g. CMI) is chosen here by PAYMENT_PROVIDER.
  providers: [PaymentsService, { provide: PAYMENT_PROVIDER, useClass: StubPaymentProvider }],
  exports: [PaymentsService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
