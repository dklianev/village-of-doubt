type AuthErrorLike =
  | string
  | {
      code?: string | null | undefined;
      message?: string | null | undefined;
      statusText?: string | null | undefined;
    }
  | null
  | undefined;

export function mapAuthError(error: AuthErrorLike, fallback = "Възникна грешка. Опитай пак."): string {
  const code = typeof error === "string" ? error : (error?.code ?? "");
  const message = typeof error === "string" ? error : (error?.message ?? error?.statusText ?? "");
  const normalized = `${code} ${message}`.toLowerCase();

  if (hasCyrillic(message)) {
    return message;
  }

  if (matchesAny(normalized, ["user_not_found", "user not found", "not found", "invalid email"])) {
    return "Няма досие с този имейл.";
  }
  if (matchesAny(normalized, ["invalid_password", "invalid password", "password is incorrect", "bad password"])) {
    return "Грешна парола.";
  }
  if (matchesAny(normalized, ["email_exists", "email already", "already exists", "user already exists"])) {
    return "Този имейл вече има досие. Влез или ползвай „Забравена парола?“.";
  }
  if (matchesAny(normalized, ["weak_password", "password too short", "too weak"])) {
    return "Паролата е твърде слаба.";
  }
  if (matchesAny(normalized, ["email_not_verified", "not verified", "verify email"])) {
    return "Първо потвърди имейла си. Виж пощата.";
  }
  if (matchesAny(normalized, ["rate_limit", "too many", "429"])) {
    return "Твърде много опити. Опитай след минута.";
  }
  if (matchesAny(normalized, ["token", "expired", "invalid link", "invalid reset"])) {
    return "Линкът е изтекъл или вече е използван.";
  }

  return fallback;
}

function matchesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function hasCyrillic(value: string) {
  return /[А-Яа-яЁё]/.test(value);
}
