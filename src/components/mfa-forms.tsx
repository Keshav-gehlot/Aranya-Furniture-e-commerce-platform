"use client";
import { useActionState, useState, useTransition } from "react";
import { confirmMfaSetup, reauthAction, startMfaSetup, verifyMfaLogin, type FormState } from "@/app/actions/auth";

function CodeInput({ allowRecovery = false }: { allowRecovery?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor="code">{allowRecovery ? "6-digit code or recovery code" : "6-digit code"}</label>
      <input
        id="code"
        name="code"
        className="input text-center font-mono text-xl tracking-[0.3em]"
        inputMode={allowRecovery ? "text" : "numeric"}
        autoComplete="one-time-code"
        maxLength={allowRecovery ? 11 : 6}
        required
        autoFocus
      />
    </div>
  );
}

export function MfaLoginForm() {
  const [state, action, pending] = useActionState(verifyMfaLogin, undefined);
  return (
    <form action={action} className="space-y-4">
      <CodeInput allowRecovery />
      {state?.error && <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full py-3" disabled={pending}>{pending ? "Checking…" : "Verify and sign in"}</button>
      <p className="text-xs text-stone">Lost your phone? Enter one of your recovery codes, or ask an administrator to reset your two-step sign-in.</p>
    </form>
  );
}

export function ReauthForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(reauthAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <CodeInput />
      {state?.error && <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full py-3" disabled={pending}>{pending ? "Checking…" : "Confirm"}</button>
    </form>
  );
}

export function MfaSetup({ alreadyEnabled }: { alreadyEnabled: boolean }) {
  const [setup, setSetup] = useState<FormState>(undefined);
  const [starting, start] = useTransition();
  const [state, action, pending] = useActionState(confirmMfaSetup, undefined);

  if (state?.codes) {
    return (
      <div className="space-y-4">
        <p className="rounded-sm bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{state.ok}</p>
        <div>
          <p className="font-semibold">Save your recovery codes</p>
          <p className="mt-1 text-sm text-stone">Each code works once if you lose your phone. Store them in a password manager. They won't be shown again.</p>
        </div>
        <ul className="grid grid-cols-2 gap-2 rounded-sm bg-sand p-4 font-mono text-sm">
          {state.codes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <a href="/admin" className="btn-primary w-full py-3">I've saved them — go to the admin panel</a>
      </div>
    );
  }

  // Turning MFA on refreshes the session cookie, which re-renders this page; the codes above stay in state.
  if (alreadyEnabled) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-stone">Two-step sign-in is already on for your account.</p>
        <a href="/admin" className="btn-primary w-full py-3">Go to the admin panel</a>
      </div>
    );
  }

  if (!setup?.qr) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-stone">Install an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password or Authy) on your phone, then continue.</p>
        {setup?.error && <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-700">{setup.error}</p>}
        <button className="btn-primary w-full py-3" disabled={starting} onClick={() => start(async () => setSetup(await startMfaSetup()))}>
          {starting ? "Preparing…" : "Show my QR code"}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-stone">
        <li>Scan this QR code with your authenticator app.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <img src={setup.qr} alt="QR code for your authenticator app" width={220} height={220} className="mx-auto rounded-sm bg-white p-2 ring-1 ring-ink/10" />
      <p className="text-center text-xs text-stone">Can't scan? Enter this key: <span className="select-all break-all font-mono text-ink">{setup.secret}</span></p>
      <CodeInput />
      {state?.error && <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full py-3" disabled={pending}>{pending ? "Checking…" : "Turn on two-step sign-in"}</button>
    </form>
  );
}
