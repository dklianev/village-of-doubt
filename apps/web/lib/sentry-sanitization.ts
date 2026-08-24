type UnknownRecord = Record<string, unknown>;

const SENSITIVE_KEY = /(?:authorization|cookie|token|secret|password|chat|message|role|room.?code|user.?id|email|display.?name)/i;
const SENSITIVE_VALUE = /\b(authorization|token|secret|password|room.?code|user.?id|email)\s*[:=]\s*[^\s,;&}]+/gi;
const MONITORING_URL = /https?:\/\/[^\s"'<>]+/gi;
const ROUTE_KEY = /^(?:url|href|from|to|route|path)$/i;
const REDACTED = "[ПРЕМАХНАТО]";

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

function sanitizeException(exception: UnknownRecord): UnknownRecord {
  return {
    ...exception,
    ...(Array.isArray(exception.values)
      ? {
          values: exception.values.map((value) => {
            if (!isRecord(value)) {
              return value;
            }
            return {
              ...value,
              ...(typeof value.value === "string" ? { value: sanitizeMonitoringText(value.value) } : {}),
              ...(typeof value.type === "string" ? { type: sanitizeMonitoringText(value.type) } : {}),
            };
          }),
        }
      : {}),
  };
}

function sanitizeMonitoringText(value: string) {
  const withSafeUrls = value.replace(MONITORING_URL, (candidate) => {
    const trailing = candidate.match(/[.,)!?]+$/)?.[0] ?? "";
    const url = trailing ? candidate.slice(0, -trailing.length) : candidate;
    return `${sanitizeMonitoringUrl(url)}${trailing}`;
  });
  return withSafeUrls.replace(SENSITIVE_VALUE, (_match, key: string) => `${key}=${REDACTED}`);
}

export function sanitizeMonitoringBreadcrumb<T extends object>(breadcrumb: T): T {
  const breadcrumbRecord = breadcrumb as UnknownRecord;
  if (!isRecord(breadcrumbRecord.data)) {
    return breadcrumb;
  }
  const data = redactRecord(breadcrumbRecord.data);
  if (typeof breadcrumbRecord.data.url === "string") {
    data.url = sanitizeMonitoringUrl(breadcrumbRecord.data.url);
  }
  return { ...breadcrumbRecord, data } as T;
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
          ? value.map((item) => isRecord(item) ? redactRecord(item) : item)
          : value,
  ]));
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
