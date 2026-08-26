"use client";

import { useEffect, useState } from 'react';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { useAuth } from '@/components/auth-context';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ShieldCheck, AlertCircle, Fingerprint } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFingerprintLoading, setIsFingerprintLoading] = useState(false);
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const { login } = useAuth();

  useEffect(() => {
    setWebAuthnSupported(browserSupportsWebAuthn());
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? 'Invalid username or password. Please try again.');
        setIsLoading(false);
        return;
      }

      login(data.user);
    } catch {
      setError('Unable to reach server. Please try again.');
      setIsLoading(false);
    }
  };

  const handleFingerprintLogin = async () => {
    setIsFingerprintLoading(true);
    setError(null);

    try {
      const optionsResponse = await fetch('/api/webauthn/login-options', { method: 'POST' });
      if (!optionsResponse.ok) {
        throw new Error('Tidak dapat mulakan log masuk fingerprint.');
      }
      const optionsJSON = await optionsResponse.json();

      const assertionResponse = await startAuthentication({ optionsJSON });

      const verifyResponse = await fetch('/api/webauthn/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertionResponse }),
      });

      const data = await verifyResponse.json().catch(() => ({}));

      if (!verifyResponse.ok) {
        throw new Error(data.error ?? 'Log masuk fingerprint gagal.');
      }

      login(data.user);
    } catch (err) {
      const message = (err as Error).name === 'NotAllowedError'
        ? 'Log masuk fingerprint dibatalkan.'
        : (err as Error).message || 'Log masuk fingerprint gagal.';
      setError(message);
      setIsFingerprintLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#7b2d3a]/10 via-background to-background">
      <Card className="w-full max-w-md border-none shadow-2xl animate-fade-in">
        <CardHeader className="space-y-1 flex flex-col items-center text-center pb-8">
          <div className="w-16 h-16 bg-[#7b2d3a] rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <ShieldCheck className="text-[#fff7f8] h-10 w-10" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">KVar3.1</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="animate-in fade-in zoom-in duration-300">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                placeholder="admin" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <PasswordInput 
                id="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-secondary/50"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Logging in...
                </div>
              ) : "Sign In"}
            </Button>
          </CardFooter>
        </form>

        {webAuthnSupported && (
          <div className="px-8 pb-2">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Atau</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 gap-2"
              onClick={handleFingerprintLogin}
              disabled={isFingerprintLoading}
            >
              <Fingerprint size={18} />
              {isFingerprintLoading ? 'Mengesahkan...' : 'Log Masuk dengan Fingerprint'}
            </Button>
          </div>
        )}

        <div className="px-8 pb-8 pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Protected by enterprise-grade security.
          </p>
        </div>
      </Card>
    </div>
  );
}