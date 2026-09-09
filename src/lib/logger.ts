type LogFields = Record<string, unknown>;

function sanitize(fields: LogFields): LogFields {
  const blocked = new Set([
    "raw_text",
    "original_raw_text",
    "interpreted_text",
    "raw_content",
    "content",
    "prompt",
    "input",
    "api_key",
    "gemini_api_key",
    "gemini_api_key_encrypted",
  ]);
  return Object.fromEntries(
    Object.entries(fields).filter(([key]) => !blocked.has(key)),
  );
}

export const logger = {
  info(message: string, fields: LogFields = {}) {
    console.info(JSON.stringify({ level: "info", message, ...sanitize(fields) }));
  },
  warn(message: string, fields: LogFields = {}) {
    console.warn(JSON.stringify({ level: "warn", message, ...sanitize(fields) }));
  },
  error(message: string, fields: LogFields = {}) {
    console.error(JSON.stringify({ level: "error", message, ...sanitize(fields) }));
  },
};
