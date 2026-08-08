'use client';

import { ThemeProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { ConfirmProvider } from '@/components/ui/confirm';

function Notifications() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      dir="rtl"
      position="bottom-center"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      richColors
      closeButton
      toastOptions={{ style: { fontFamily: 'var(--font-heebo)' } }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <DirectionProvider direction="rtl">
        <ConfirmProvider>{children}</ConfirmProvider>
        <Notifications />
      </DirectionProvider>
    </ThemeProvider>
  );
}
