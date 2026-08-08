'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { MoonIcon, SunIcon } from '@/components/icons';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // resolvedTheme is unknown during SSR, so anything derived from it has to
  // wait for mount or the server and client markup disagree.
  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={mounted && isDark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative overflow-hidden"
    >
      {/*
        Both icons stay mounted and cross-fade/rotate, so the swap reads as one
        object turning rather than two icons popping in and out.
      */}
      <SunIcon
        className={`absolute size-[1.15rem] transition-[opacity,transform] duration-250 ease-snap ${
          isDark ?'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'
        }`}
      />
      <MoonIcon
        className={`absolute size-[1.15rem] transition-[opacity,transform] duration-250 ease-snap ${
          isDark ?'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'
        }`}
      />
    </Button>
  );
}
