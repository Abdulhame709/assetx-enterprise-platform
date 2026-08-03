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
      res.status(http).json({
        data: null,
        error: { code, message: exception.message, details: {} },
      });
      return;
    }

    // Unknown internal error
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'internal_error', details: {} },
    });
  }
}
