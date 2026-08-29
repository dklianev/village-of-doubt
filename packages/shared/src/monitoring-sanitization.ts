type UnknownRecord = Record<string, unknown>;

const SENSITIVE_KEY = /(?:authorization|cookie|token|secret|password|chat|message|role|room.?code|user.?id|email|display.?name|sql|query|statement|params?|parameters?|bind.?values?)/i;
const SENSITIVE_VALUE = /(["']?)(authorization|cookie|token|secret|password|chat(?:message)?|message|role|room.?code|user.?id|email|display.?name)\1\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;&}]+)/gi;
const GAME_ROOM_CONTEXT = /\[GameRoom\s+[^\]\s]+\]/gi;
const MONITORING_URL = /https?:\/\/[^\s"'<>]+/gi;
const PRIVATE_ROUTE_IN_TEXT = /(?:\/(?:play|lobby)\/[^/?#\s,;)"'<>]+(?:\?[^\s,;)"'<>]*)?|\/history\/[^/?#\s,;)"'<>]+\/replay(?:\?[^\s,;)"'<>]*)?)/gi;
const ROUTE_KEY = /^(?:url|href|from|to|route|path)$/i;
const DATABASE_ERROR_TEXT = /(?:^|\r?\n)\s*Failed query:[\s\S]*(?:^|\r?\n)\s*params\s*:/im;
const DATABASE_ERROR_TYPE = /^(?:DrizzleQueryError|Postgres(?:Js)?Error|DatabaseError)$/i;
const SAFE_OPERATION = /^[a-z][a-z0-9.-]{0,63}$/;
const SAFE_ERROR_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const SAFE_SQLSTATE = /^[0-9A-Z]{5}$/;
const SAFE_CORRELATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_SYSTEM_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
]);
const REDACTED = "[ПРЕМАХНАТО]";
const REDACTED_DATABASE_ERROR = `Database operation failed; details=${REDACTED}`;

export interface MonitoringErrorProjectionContext {
  operation: string;
  correlationId: string;
  roomIdentifier?: string;
}

export interface ProjectedMonitoringError extends Error {
  readonly operation: string;
  readonly code: string;
  readonly correlationId: string;
  readonly roomIdentifier?: string;
}

export interface SafeMonitoringErrorMetadata {
  readonly name: string;
  readonly code: string;
  readonly status: number | null;
}

export function sanitizeMonitoringUrl(value: string) {
  try {
    const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(value);
    const url = new URL(value, "https://monitoring.invalid");
    const pathname = normalizePrivatePath(url.pathname);
    return absolute ? `${url.origin}${pathname}` : pathname;
  } catch {
    return "/invalid-monitoring-url";
  }
}

export function sanitizeMonitoringEvent<T extends object>(event: T): T {
  const eventRecord = event as UnknownRecord;
  const { user: _user, ...safeEvent } = eventRecord;
  const request = isRecord(eventRecord.request)
    ? {
        ...eventRecord.request,
        ...(typeof eventRecord.request.url === "string" ? { url: sanitizeMonitoringUrl(eventRecord.request.url) } : {}),
        ...(isRecord(eventRecord.request.headers) ? { headers: redactRecord(eventRecord.request.headers) } : {}),
        data: undefined,
        query_string: undefined,
      }
    : eventRecord.request;
  const exception = isRecord(eventRecord.exception)
    ? sanitizeException(eventRecord.exception)
    : eventRecord.exception;
  const logentry = isRecord(eventRecord.logentry)
    ? {
        ...eventRecord.logentry,
        ...(typeof eventRecord.logentry.message === "string"
          ? { message: sanitizeMonitoringText(eventRecord.logentry.message) }
          : {}),
      }
    : eventRecord.logentry;

  return {
    ...safeEvent,
    ...(typeof eventRecord.message === "string" ? { message: sanitizeMonitoringText(eventRecord.message) } : {}),
    ...(typeof eventRecord.transaction === "string"
      ? { transaction: sanitizeMonitoringText(eventRecord.transaction) }
      : {}),
    ...(exception === undefined ? {} : { exception }),
    ...(logentry === undefined ? {} : { logentry }),
    ...(request === undefined ? {} : { request }),
    ...(isRecord(eventRecord.tags) ? { tags: redactRecord(eventRecord.tags) } : {}),
    ...(isRecord(eventRecord.extra) ? { extra: redactRecord(eventRecord.extra) } : {}),
    ...(isRecord(eventRecord.contexts) ? { contexts: redactRecord(eventRecord.contexts) } : {}),
    ...(Array.isArray(eventRecord.breadcrumbs)
      ? { breadcrumbs: eventRecord.breadcrumbs.map((breadcrumb) => sanitizeMonitoringBreadcrumb(breadcrumb as object)) }
      : {}),
  } as T;
}

export function sanitizeMonitoringBreadcrumb<T extends object>(breadcrumb: T): T {
  const breadcrumbRecord = breadcrumb as UnknownRecord;
  const data = isRecord(breadcrumbRecord.data) ? redactRecord(breadcrumbRecord.data) : undefined;
  if (data && isRecord(breadcrumbRecord.data) && typeof breadcrumbRecord.data.url === "string") {
    data.url = sanitizeMonitoringUrl(breadcrumbRecord.data.url);
  }

  return {
    ...breadcrumbRecord,
    ...(typeof breadcrumbRecord.message === "string"
      ? { message: sanitizeMonitoringText(breadcrumbRecord.message) }
      : {}),
    ...(data === undefined ? {} : { data }),
  } as T;
}

export function projectMonitoringError(
  error: unknown,
  context: MonitoringErrorProjectionContext,
): ProjectedMonitoringError {
  const operation = SAFE_OPERATION.test(context.operation)
    ? context.operation
    : "unknown-operation";
  const correlationId = SAFE_CORRELATION_ID.test(context.correlationId)
    ? context.correlationId
    : REDACTED;
  const code = readSafeErrorCode(error);
  const roomIdentifier = context.roomIdentifier === undefined
    ? undefined
    : `[GameRoom ${REDACTED}]`;
  const message = [
    "Persistence operation failed",
    `operation=${operation}`,
    `code=${code}`,
    `correlationId=${correlationId}`,
    ...(roomIdentifier ? [`roomIdentifier=${roomIdentifier}`] : []),
  ].join("; ");
  const projected = new Error(message) as ProjectedMonitoringError;
  projected.name = "ProjectedMonitoringError";
  return Object.assign(projected, {
    operation,
    code,
    correlationId,
    ...(roomIdentifier ? { roomIdentifier } : {}),
  });
}

export function safeMonitoringErrorMetadata(error: unknown): SafeMonitoringErrorMetadata {
  if (!isRecord(error)) {
    return { name: "UnknownError", code: "UNKNOWN", status: null };
  }

  const name = typeof error.name === "string" && SAFE_ERROR_NAME.test(error.name)
    ? error.name
    : "UnknownError";
  const status = typeof error.status === "number"
    && Number.isInteger(error.status)
    && error.status >= 100
    && error.status <= 599
    ? error.status
    : null;

  return {
    name,
    code: readSafeErrorCode(error),
    status,
  };
}

function sanitizeException(exception: UnknownRecord): UnknownRecord {
  const sanitized = redactRecord(exception);
  const originalValues = exception.values;
  const sanitizedValues = sanitized.values;
  if (!Array.isArray(originalValues) || !Array.isArray(sanitizedValues)) {
    return sanitized;
  }

  return {
    ...sanitized,
    values: sanitizedValues.map((value, index) => {
      const original = originalValues[index];
      if (!isRecord(original) || !isRecord(value) || !isDatabaseErrorType(original.type)) {
        return value;
      }
      return {
        ...value,
        value: REDACTED_DATABASE_ERROR,
      };
    }),
  };
}

function sanitizeMonitoringText(value: string) {
  if (DATABASE_ERROR_TEXT.test(value)) {
    return REDACTED_DATABASE_ERROR;
  }
  const withoutRoomContext = value.replace(GAME_ROOM_CONTEXT, `[GameRoom ${REDACTED}]`);
  const withSafeUrls = withoutRoomContext.replace(MONITORING_URL, (candidate) => {
    const trailing = candidate.match(/[.,)!?]+$/)?.[0] ?? "";
    const url = trailing ? candidate.slice(0, -trailing.length) : candidate;
    return `${sanitizeMonitoringUrl(url)}${trailing}`;
  });
  const withSafeRoutes = withSafeUrls.replace(PRIVATE_ROUTE_IN_TEXT, (candidate) =>
    sanitizeMonitoringUrl(candidate));
  return withSafeRoutes.replace(
    SENSITIVE_VALUE,
    (_match, quote: string, key: string) => `${quote}${key}${quote}=${REDACTED}`,
  );
}

function normalizePrivatePath(pathname: string) {
  const normalized = pathname.replace(/\/$/, "") || "/";
  if (/^\/play\/[^/]+$/.test(normalized)) return "/play/[code]";
  if (/^\/lobby\/[^/]+$/.test(normalized)) return "/lobby/[code]";
  if (/^\/history\/[^/]+\/replay$/.test(normalized)) return "/history/[gameId]/replay";
  return normalized;
}

function redactRecord(record: UnknownRecord): UnknownRecord {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [
    key,
    SENSITIVE_KEY.test(key)
      ? REDACTED
      : ROUTE_KEY.test(key) && typeof value === "string"
        ? sanitizeMonitoringUrl(value)
        : isRecord(value)
          ? redactRecord(value)
          : Array.isArray(value)
            ? value.map((item) => isRecord(item)
              ? redactRecord(item)
              : typeof item === "string"
                ? sanitizeMonitoringText(item)
                : item)
            : typeof value === "string"
              ? sanitizeMonitoringText(value)
              : value,
  ]));
}

function isDatabaseErrorType(value: unknown) {
  return typeof value === "string" && DATABASE_ERROR_TYPE.test(value);
}

function readSafeErrorCode(error: unknown) {
  let current = error;
  const visited = new Set<object>();
  for (let depth = 0; depth < 4 && isRecord(current) && !visited.has(current); depth += 1) {
    visited.add(current);
    const code = current.code;
    if (typeof code === "string" && (SAFE_SQLSTATE.test(code) || SAFE_SYSTEM_ERROR_CODES.has(code))) {
      return code;
    }
    current = current.cause;
  }
  return "UNKNOWN";
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
