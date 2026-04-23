import { Injectable } from '@angular/core';

type LogLevel = 'info' | 'warn' | 'error';

@Injectable({
  providedIn: 'root',
})
export class AppLoggerService {
  log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    const payload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...context,
    };

    if (level === 'error') {
      console.error(payload);
      return;
    }

    if (level === 'warn') {
      console.warn(payload);
      return;
    }

    console.info(payload);
  }
}
