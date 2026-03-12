/**
 * Error subclass for API responses with HTTP status codes.
 * Replaces the `new Error('...') as Error & { status: number }` cast pattern
 * used throughout query hooks, enabling proper `instanceof` narrowing.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
