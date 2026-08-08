'use client';

import * as React from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Button } from './button';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn>(async () => false);

/**
 * Replaces window.confirm with a real dialog. Reserved for genuinely
 * consequential actions (sending to N guests, deleting) — confirming
 * everything just trains people to click through.
 */
export function useConfirm() {
  return React.useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const resolverRef = React.useRef<(value: boolean) => void>(() => {});

  const confirm = React.useCallback<ConfirmFn>((next) => {
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = React.useCallback((value: boolean) => {
    resolverRef.current(value);
    setOpen(false);
  }, []);

  const danger = options?.tone === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) settle(false);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] transition-opacity duration-200 ease-snap data-ending-style:opacity-0 data-starting-style:opacity-0" />
          {/*
            A modal is not anchored to a trigger, so it stays centred and scales
            from its own centre — the popover origin rule doesn't apply here.
          */}
          <AlertDialog.Popup className="card fixed start-1/2 top-1/2 z-50 flex w-[min(26rem,calc(100vw-2rem))] translate-x-1/2 -translate-y-1/2 flex-col gap-4 p-5 transition-[opacity,scale] duration-200 ease-snap outline-none data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0">
            <div className="flex flex-col gap-1.5">
              <AlertDialog.Title className="text-lg font-semibold">
                {options?.title}
              </AlertDialog.Title>
              {options?.description ? (
                <AlertDialog.Description className="text-sm leading-relaxed text-muted">
                  {options.description}
                </AlertDialog.Description>
              ) : null}
            </div>
            <div className="flex justify-start gap-2">
              <Button variant={danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
                {options?.confirmLabel ?? 'אישור'}
              </Button>
              <Button variant="ghost" onClick={() => settle(false)}>
                {options?.cancelLabel ?? 'ביטול'}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}
