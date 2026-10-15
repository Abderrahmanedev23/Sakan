/**
 * Contract every payment provider (CMI, a wallet, ...) implements, so the
 * provider can be swapped without touching session or entry logic.
 */
export interface CreateCheckoutInput {
  paymentReference: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
  returnUrl: string;
}

export interface CheckoutSession {
  /** Where the client sends the user to pay. */
  redirectUrl: string;
  providerTransactionId: string;
}

export interface VerifiedCallback {
  paymentReference: string;
  providerTransactionId: string;
  succeeded: boolean;
  failureReason?: string;
  rawPayload: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /** Validates the provider's signature and parses the callback. Throws if invalid. */
  verifyCallback(headers: Record<string, string | string[] | undefined>, body: unknown): Promise<VerifiedCallback>;
  refund(providerTransactionId: string, amountCents: number): Promise<void>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
