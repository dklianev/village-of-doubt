# / — acceptance criteria

## Functional
- [ ] Loads in < 1.5s on slow-3G (Lighthouse mobile)
- [ ] Without JS, primary content visible
- [ ] All links keyboard-reachable
- [ ] ESC closes modals; clicking overlay closes
- [ ] Errors surface via Toast or inline

## Visual
- [ ] Hero uses `<SceneCard>` or `<PaperCard>` — no custom `<div>`
- [ ] Headings: Display primitive, no inline `<h1>` with inline styles
- [ ] CTAs: Pill primitive, never raw `<button>`
- [ ] Empty states use `EmptyState` primitive with artifact
- [ ] Cards never overflow viewport at 375px width

## Bulgarian copy
- [ ] No English in JSX text (hard fail)
- [ ] No anglicisms — „Логин", „Аватар", „Чат" — forbidden
- [ ] Page-specific terms match `docs/dictionary.md`

## Accessibility
- [ ] Lighthouse Accessibility ≥ 95
- [ ] axe-core zero violations
- [ ] Focus ring visible on every interactive element
- [ ] Color contrast AA

## Performance
- [ ] Lighthouse Performance ≥ 85 desktop / 75 mobile
- [ ] CLS < 0.05
- [ ] Animation paint < 250ms
- [ ] Total JS for route < 200 KB gzipped

## Visual regression
- [ ] Baselines exist at 375 / 768 / 1280
- [ ] Dark + light themes captured
- [ ] Diff with main < 1% pixels
