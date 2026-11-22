// Payment adapter. The prototype ships a cash provider and a simulated wallet
// provider that mimics the redirect flow of Tunisian wallets (D17, Flouci) and
// cards (e-dinar / ClicToPay). A real provider implements the same interface.
import { randomUUID } from "node:crypto";

export type PaymentMethod = "cash" | "d17" | "flouci" | "card";
export const PAYMENT_METHODS: PaymentMethod[] = ["cash", "d17", "flouci", "card"];

export interface PaymentIntent {
  ref: string;
  method: PaymentMethod;
  amountMillimes: number;
  /** Where the driver goes to approve the payment; null when nothing to approve. */
  redirectUrl: string | null;
  /** Booking is confirmed right away (cash is paid at the spot). */
  confirmedImmediately: boolean;
}

export interface PaymentProvider {
  readonly methods: PaymentMethod[];
  createIntent(bookingId: string, amountMillimes: number, method: PaymentMethod): Promise<PaymentIntent>;
  /** Called by the provider's return/callback. Resolves to true when paid. */
  confirm(ref: string, amountMillimes: number, approved: boolean): Promise<boolean>;
  refund(ref: string, amountMillimes: number): Promise<{ refunded: boolean }>;
}

export class CashProvider implements PaymentProvider {
  readonly methods: PaymentMethod[] = ["cash"];
  async createIntent(bookingId: string, amountMillimes: number): Promise<PaymentIntent> {
    return {
      ref: `cash_${bookingId.slice(0, 8)}`,
      method: "cash",
      amountMillimes,
      redirectUrl: null,
      confirmedImmediately: true,
    };
  }
  async confirm(): Promise<boolean> {
    return true;
  }
  async refund(): Promise<{ refunded: boolean }> {
    return { refunded: false }; // nothing was charged
  }
}

/**
 * Simulated wallet / card gateway. Deterministic so tests and demos are
 * reproducible: the simulated approval page has "Approve" and "Decline"
 * buttons, so the jury can walk the failure path on purpose.
 */
export class MockWalletProvider implements PaymentProvider {
  readonly methods: PaymentMethod[] = ["d17", "flouci", "card"];

  async createIntent(bookingId: string, amountMillimes: number, method: PaymentMethod): Promise<PaymentIntent> {
    const ref = `sim_${method}_${randomUUID().slice(0, 12)}`;
    return {
      ref,
      method,
      amountMillimes,
      redirectUrl: `/pay/${bookingId}?ref=${ref}`,
      confirmedImmediately: false,
    };
  }

  async confirm(ref: string, amountMillimes: number, approved: boolean): Promise<boolean> {
    return approved && ref.startsWith("sim_") && amountMillimes > 0;
  }

  async refund(): Promise<{ refunded: boolean }> {
    return { refunded: true };
  }
}

const cash = new CashProvider();
const wallet = new MockWalletProvider();

export function providerFor(method: PaymentMethod): PaymentProvider {
  return method === "cash" ? cash : wallet;
}
