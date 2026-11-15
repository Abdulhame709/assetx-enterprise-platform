/**
 * Global exception filter — maps domain errors to standard HTTP responses.
 * Reference: API Spec (DOC-10) §16 error format · error-codes.ts
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ERROR_CODES } from './error-codes';

/** 4xx status carried by an Express/http-errors style exception, if any. */
export function clientErrorStatus(exception: unknown): number | null {
  if (!exception || typeof exception !== 'object') return null;
  const candidate = exception as { status?: unknown; statusCode?: unknown; expose?: unknown };
  const status = typeof candidate.status === 'number' ? candidate.status : candidate.statusCode;
  if (typeof status !== 'number' || candidate.expose !== true) return null;
  return status >= 400 && status < 500 ? status : null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    // NestJS-native HTTP exceptions
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json({
        data: null,
        error: {
          code: status === HttpStatus.NOT_FOUND ? 'NOT_FOUND' : 'HTTP_ERROR',
          message: typeof body === 'string' ? body : (body as { message?: string }).message,
          details: {},
        },
      });
      return;
    }

    // Domain errors (Error with a known message)
    if (exception instanceof Error && ERROR_CODES[exception.message]) {
      const { http, code } = ERROR_CODES[exception.message];
      const details = exception && typeof exception === 'object' && 'details' in exception
        ? (exception as { details?: Record<string, unknown> }).details ?? {}
        : {};
      res.status(http).json({
        data: null,
        error: { code, message: exception.message, details },
      });
      return;
    }

    // Client errors raised by Express middleware (body-parser: oversized or
    // malformed JSON) are http-errors, not Nest exceptions. Without this they would
    // surface as 500 internal_error and flood the logs with stack traces.
    const clientStatus = clientErrorStatus(exception);
    if (clientStatus) {
      res.status(clientStatus).json({
        data: null,
        error: {
          code: clientStatus === 413 ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR',
          message: clientStatus === 413 ? 'request_body_too_large' : 'request_body_invalid',
          details: {},
        },
      });
      return;
    }

    // Unknown internal error
    // eslint-disable-next-line no-console
    console.error('[HttpExceptionFilter] Unhandled error:', exception instanceof Error ? exception.stack : exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'internal_error', details: {} },
    });
  }
}
