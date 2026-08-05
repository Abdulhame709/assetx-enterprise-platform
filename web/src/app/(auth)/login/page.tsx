'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boxes } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/form';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/lib/auth/session-context';
import { MOCK_ACCOUNTS } from '@/lib/auth/mock-session';
import { AUTH_MODE } from '@/lib/auth/auth-service';

export default function LoginPage() {
  const { login } = useSession();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ username, password });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white">
          <Boxes className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-semibold text-ink">Sign in to AssetX</h1>
        <p className="text-sm text-ink-muted">Enterprise Asset Management Platform</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Username">
          <Input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" required />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>

      {AUTH_MODE === 'mock' && (
        <div className="mt-6 rounded-lg bg-surface-muted p-3 text-xs text-ink-muted">
          <p className="mb-1 font-medium text-ink">Demo accounts (mock mode — development only)</p>
          <ul className="space-y-0.5">
            {Object.entries(MOCK_ACCOUNTS).map(([u, a]) => (
              <li key={u}>
                <span className="font-mono">{u}</span> / <span className="font-mono">{a.password}</span> — {a.displayName}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
