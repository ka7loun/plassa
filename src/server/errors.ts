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
  | "rate_limited"
  | "method_not_accepted"
  | "own_spot"
  | "phone_taken"
  | "bad_credentials"
  | "not_reviewable"
  | "already_reviewed"
  | "too_large";

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
  method_not_accepted: 422,
  own_spot: 422,
  phone_taken: 409,
  bad_credentials: 401,
  not_reviewable: 422,
  already_reviewed: 409,
  too_large: 413,
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
