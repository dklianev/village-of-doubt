"use client";

export function AchievementProgressWreath({ unlocked, total }: { unlocked: number; total: number }) {
  return (
    <div className="achievement-wreath" role="img" aria-label={`${unlocked} от ${total} легенди отключени`}>
      <svg className="achievement-wreath-branch" viewBox="0 0 60 80" aria-hidden="true">
        <path d="M55 75 Q40 55 35 30" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M50 65 Q35 60 28 50" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M48 50 Q32 45 25 32" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M45 35 Q30 30 22 18" stroke="currentColor" strokeWidth="1" fill="none" />
        <ellipse cx="42" cy="58" rx="6" ry="2" transform="rotate(-50 42 58)" fill="currentColor" opacity="0.7" />
        <ellipse cx="36" cy="42" rx="5" ry="1.8" transform="rotate(-55 36 42)" fill="currentColor" opacity="0.7" />
        <ellipse cx="30" cy="26" rx="4.5" ry="1.6" transform="rotate(-60 30 26)" fill="currentColor" opacity="0.7" />
      </svg>
      <div className="achievement-wreath-count">
        <strong>{unlocked}</strong>
        <span>от {total} легенди</span>
      </div>
      <svg className="achievement-wreath-branch achievement-wreath-branch-right" viewBox="0 0 60 80" aria-hidden="true">
        <path d="M55 75 Q40 55 35 30" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M50 65 Q35 60 28 50" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M48 50 Q32 45 25 32" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M45 35 Q30 30 22 18" stroke="currentColor" strokeWidth="1" fill="none" />
        <ellipse cx="42" cy="58" rx="6" ry="2" transform="rotate(-50 42 58)" fill="currentColor" opacity="0.7" />
        <ellipse cx="36" cy="42" rx="5" ry="1.8" transform="rotate(-55 36 42)" fill="currentColor" opacity="0.7" />
        <ellipse cx="30" cy="26" rx="4.5" ry="1.6" transform="rotate(-60 30 26)" fill="currentColor" opacity="0.7" />
      </svg>
    </div>
  );
}
