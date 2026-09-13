export function BrandLogo() {
  return <>
    <span className="site-brand-wordmark" role="img" aria-label="Сенките" />
    {process.env.NEXT_PUBLIC_SHOW_BETA_BADGE !== "false" ? <span className="site-beta-badge">Бета</span> : null}
  </>;
}
