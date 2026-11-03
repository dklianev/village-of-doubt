function showsBetaBadge() {
  return process.env.NEXT_PUBLIC_SHOW_BETA_BADGE !== "false";
}

// A link's name must contain the text it shows, so voice control users can say what they see.
export function brandHomeLabel() {
  return showsBetaBadge() ? "Сенките Бета, начало" : "Сенките, начало";
}

export function BrandLogo() {
  return <>
    <span className="site-brand-wordmark" role="img" aria-label="Сенките" />
    {showsBetaBadge() ? <span className="site-beta-badge">Бета</span> : null}
  </>;
}
