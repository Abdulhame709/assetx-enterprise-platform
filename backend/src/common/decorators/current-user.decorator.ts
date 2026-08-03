/**
 * CurrentUser decorator — injects the authenticated user payload from the request.
 */
export interface RequestUser {
  sub: string;
  username: string;
  tenant_id: string;
  role: string;
  session_id: string;
}

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as RequestUser;
  },
);
