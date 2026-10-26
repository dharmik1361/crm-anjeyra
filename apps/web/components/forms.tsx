"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/app/actions";

type BoundAction = (state: ActionState, form: FormData) => Promise<ActionState>;

/** A form wired to a server action, showing its error/ok message. */
export function ActionForm({
  action,
  children,
  className,
  resetOnOk = false,
}: {
  action: BoundAction;
  children: ReactNode;
  className?: string;
  resetOnOk?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={className}
      key={resetOnOk && state?.ok ? JSON.stringify(state) + Math.random() : undefined}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-brand">{state.ok}</p>}
    </form>
  );
}
