interface BaseTemplateParams {
  brandUrl: string;
}

interface ResetPasswordParams extends BaseTemplateParams {
  resetUrl: string;
  displayName: string;
}

interface VerifyEmailParams extends BaseTemplateParams {
  verifyUrl: string;
  displayName: string;
}

interface FeedbackParams extends BaseTemplateParams {
  body: string;
  reporterEmail: string | null;
  page: string;
}

const STYLE_INTRO = `
  <body style="font-family: Georgia, 'Noto Serif', serif; background: #1a1410; margin: 0; padding: 24px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; margin: 0 auto; background: #f0e0c4; border: 1px solid rgba(50,30,10,0.4); border-radius: 12px;">
      <tr><td style="padding: 32px;">
`;

const STYLE_OUTRO = `
      </td></tr>
    </table>
  </body>
`;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderFooter(brandUrl: string) {
  const safeBrandUrl = escapeHtml(brandUrl);
  return `
    <p style="color: #4f3829; font-size: 12px; line-height: 1.5; margin: 24px 0 0;">
      Върколак и Мафия${safeBrandUrl ? ` · <a href="${safeBrandUrl}" style="color: #842f2b;">Към масата</a>` : ""}
    </p>
  `;
}

export function renderResetPasswordEmail(params: ResetPasswordParams) {
  const displayName = escapeHtml(params.displayName);
  const resetUrl = escapeHtml(params.resetUrl);

  const text = `Здравей, ${params.displayName}.

Получихме заявка за нова парола за твоя профил във Върколак и Мафия.

Ако ти си я заявил, отвори този линк за да създадеш нова парола:
${params.resetUrl}

Линкът е валиден за 1 час. Ако не си заявявал нова парола, просто игнорирай това писмо.

Дано следващата нощ е спокойна.
Върколак и Мафия`;

  const html = `${STYLE_INTRO}
    <h1 style="color: #842f2b; font-size: 24px; margin: 0 0 16px;">Заявка за нова парола</h1>
    <p style="color: #2a1b10; font-size: 16px; line-height: 1.55; margin: 0 0 16px;">
      Здравей, <strong>${displayName}</strong>.
    </p>
    <p style="color: #2a1b10; font-size: 16px; line-height: 1.55; margin: 0 0 24px;">
      Получихме заявка за нова парола за твоя профил във Върколак и Мафия. Ако ти си я заявил, отвори бутона по-долу за да създадеш нова парола.
    </p>
    <p style="margin: 0 0 24px;">
      <a href="${resetUrl}" style="background: #842f2b; color: #fff5e0; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Създай нова парола</a>
    </p>
    <p style="color: #4f3829; font-size: 13px; line-height: 1.5; margin: 0;">
      Линкът е валиден за 1 час. Ако не си заявявал нова парола, просто игнорирай това писмо.
    </p>
    ${renderFooter(params.brandUrl)}
  ${STYLE_OUTRO}`;

  return { subject: "Нова парола за Върколак и Мафия", html, text };
}

export function renderVerifyEmail(params: VerifyEmailParams) {
  const displayName = escapeHtml(params.displayName);
  const verifyUrl = escapeHtml(params.verifyUrl);

  const text = `Здравей, ${params.displayName}.

Потвърди имейла си за Върколак и Мафия като отвориш този линк:
${params.verifyUrl}

Линкът е валиден за 24 часа.

Добре дошъл на масата.
Върколак и Мафия`;

  const html = `${STYLE_INTRO}
    <h1 style="color: #842f2b; font-size: 24px; margin: 0 0 16px;">Потвърди имейла си</h1>
    <p style="color: #2a1b10; font-size: 16px; line-height: 1.55; margin: 0 0 16px;">
      Здравей, <strong>${displayName}</strong>.
    </p>
    <p style="color: #2a1b10; font-size: 16px; line-height: 1.55; margin: 0 0 24px;">
      Потвърди имейла си за Върколак и Мафия. Това е последната стъпка преди да отвориш първа стая.
    </p>
    <p style="margin: 0 0 24px;">
      <a href="${verifyUrl}" style="background: #842f2b; color: #fff5e0; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Потвърди имейла</a>
    </p>
    <p style="color: #4f3829; font-size: 13px; line-height: 1.5; margin: 0;">
      Линкът е валиден за 24 часа.
    </p>
    ${renderFooter(params.brandUrl)}
  ${STYLE_OUTRO}`;

  return { subject: "Потвърди имейла за Върколак и Мафия", html, text };
}

export function renderFeedbackEmail(params: FeedbackParams) {
  const [pagePathRaw, pageCategoryRaw] = params.page.includes(" · ")
    ? params.page.split(" · ", 2)
    : [params.page, null];
  const pagePath = escapeHtml(pagePathRaw);
  const pageCategory = pageCategoryRaw ? escapeHtml(pageCategoryRaw) : null;
  const reporterEmail = params.reporterEmail ? escapeHtml(params.reporterEmail) : null;
  const body = escapeHtml(params.body);

  const text = `Нова бележка от Върколак и Мафия

Страница: ${params.page}
От: ${params.reporterEmail ?? "анонимен"}

Бележка:
${params.body}`;

  const html = `${STYLE_INTRO}
    <h1 style="color: #842f2b; font-size: 22px; margin: 0 0 16px;">Нова бележка от играч</h1>
    <p style="color: #4f3829; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 4px;">страница</p>
    <p style="color: #2a1b10; font-size: 15px; margin: 0 0 16px;">
      <code style="background: rgba(50, 30, 10, 0.08); border-radius: 4px; padding: 2px 6px;">${pagePath}</code>
      ${pageCategory ? `<span style="display: inline-block; margin-left: 8px; padding: 2px 8px; background: #842f2b; color: #fff5e0; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">${pageCategory}</span>` : ""}
    </p>
    <p style="color: #4f3829; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 4px;">от</p>
    <p style="color: #2a1b10; font-size: 15px; margin: 0 0 16px;">${reporterEmail ?? "(анонимен)"}</p>
    <p style="color: #4f3829; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 4px;">бележка</p>
    <p style="color: #2a1b10; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${body}</p>
    ${renderFooter(params.brandUrl)}
  ${STYLE_OUTRO}`;

  return { subject: `Бележка от ${params.page}`, html, text };
}
