import { ReactNode } from 'react';

/** Auth layout — centered card on a muted background. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-surface-muted p-4">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
