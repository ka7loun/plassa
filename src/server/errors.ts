export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "slot_taken"
  | "outside_availability"
  | "in_the_past"
  | "not_cancellable"
  | "payment_failed"
  | "rate_limited";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  slot_taken: 409,
  outside_availability: 422,
  in_the_past: 422,
  not_cancellable: 409,
  payment_failed: 402,
  rate_limited: 429,
};

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? code);
  }
  get status() {
    return STATUS[this.code];
  }
}
