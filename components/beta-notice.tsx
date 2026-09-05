'use client';

import * as React from 'react';

type BetaNoticeProps = {
  username: string;
};

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

export function BetaNotice({ username }: BetaNoticeProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const storageKey = `wedding-broadcast-beta-notice:${username}`;

  React.useEffect(() => {
    setIsVisible(window.localStorage.getItem(storageKey) !== 'dismissed');
  }, [storageKey]);

  const dismiss = () => {
    window.localStorage.setItem(storageKey, 'dismissed');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      className="flex items-start gap-3 rounded-2xl border border-brand/25 bg-brand/8 px-4 py-3 text-sm text-foreground shadow-sm"
      dir="rtl"
      aria-label="הודעת בטא"
    >
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 17v-5" strokeLinecap="round" />
          <path d="M12 8.5h.01" strokeLinecap="round" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      </span>
      <div className="min-w-0 flex-1 leading-6">
        <p className="font-bold text-foreground">אתם בבטא סגורה וחינמית</p>
        <p className="text-muted">
          אנא העלו רק פרטים שקיבלתם רשות להשתמש בהם. השליחה מתבצעת מחשבון ה־WhatsApp שלכם ועלולה להיות מוגבלת על ידי WhatsApp; האחריות על הנמענים ותוכן ההודעות היא שלכם. השירות עדיין בניסוי ואין התחייבות מסחרית לזמינות או לשמירת מידע.
        </p>
        <p className="mt-1 text-xs text-muted">
          {SUPPORT_EMAIL ? (
            <>נתקעתם או מצאתם תקלה? <a className="font-semibold text-brand underline-offset-2 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>פנו אלינו</a>.</>
          ) : (
            <>נתקעתם או מצאתם תקלה? פנו לאדם שצירף אתכם לבטא.</>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="grid size-11 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-foreground/7 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        aria-label="הסתרת הודעת הבטא"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m7 7 10 10M17 7 7 17" strokeLinecap="round" />
        </svg>
      </button>
    </aside>
  );
}
