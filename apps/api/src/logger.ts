export type LogFields = Record<string, unknown>;

export interface Logger {
  info: (msg: string, fields?: LogFields) => void;
  warn: (msg: string, fields?: LogFields) => void;
  error: (msg: string, fields?: LogFields) => void;
}

/** Structured JSON lines on stdout. */
export function createLogger(options: { silent?: boolean } = {}): Logger {
  const write =
    (level: string) =>
    (msg: string, fields: LogFields = {}) => {
      if (options.silent) return;
      const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields });
      if (level === 'error') console.error(line);
      else console.log(line);
    };
  return { info: write('info'), warn: write('warn'), error: write('error') };
}
