import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { randomUUID } from "crypto";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params } = request;
    const user = request.user;
    const requestId = request.headers["x-request-id"] || randomUUID();

    // Set request ID for downstream use
    request.requestId = requestId;

    const startTime = Date.now();

    // Extract correlation IDs from request
    const incidentId = params?.id || body?.incidentId || query?.incidentId || null;
    const analysisId = params?.analysisId || body?.analysisId || query?.analysisId || null;
    const sessionId = params?.sessionId || body?.sessionId || query?.sessionId || null;

    // Log request (structured)
    this.logger.log({
      requestId,
      method,
      url,
      incidentId,
      analysisId,
      sessionId,
      userSub: user?.sub ? this.redactSub(user.sub) : null,
      message: `Incoming ${method} ${url}`,
    });

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        this.logger.log({
          requestId,
          method,
          url,
          statusCode: context.switchToHttp().getResponse().statusCode,
          duration,
          incidentId,
          analysisId,
          sessionId,
          message: `Completed ${method} ${url} in ${duration}ms`,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error({
          requestId,
          method,
          url,
          statusCode: error.status || 500,
          duration,
          incidentId,
          analysisId,
          sessionId,
          error: error.message,
          stack: error.stack,
          message: `Failed ${method} ${url} in ${duration}ms`,
        });
        throw error;
      })
    );
  }

  private redactSub(sub: string): string {
    // Redact user subject for logging (keep first 8 chars)
    if (!sub || sub.length <= 8) return "[REDACTED]";
    return `${sub.substring(0, 8)}...`;
  }
}
