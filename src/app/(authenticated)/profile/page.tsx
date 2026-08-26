"use client";

import { useEffect, useState } from 'react';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { PageHeader } from '@/components/layout/page-header';
import { useAuth } from '@/components/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserCircle, Shield, Save, KeyRound, Fingerprint, Trash2, Smartphone } from 'lucide-react';

type WebauthnCredentialRow = {
  id: string;
  name: string;
  deviceType: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export default function ProfilePage() {
  const { user, login } = useAuth();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const [credentials, setCredentials] = useState<WebauthnCredentialRow[]>([]);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCredentials = async () => {
    setIsLoadingCredentials(true);
    try {
      const response = await fetch('/api/webauthn/credentials', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setCredentials(data.credentials ?? []);
      }
    } finally {
      setIsLoadingCredentials(false);
    }
  };

  useEffect(() => {
    setWebAuthnSupported(browserSupportsWebAuthn());
    void loadCredentials();
  }, []);

  const handleRegisterFingerprint = async () => {
    setIsRegistering(true);
    try {
      const optionsResponse = await fetch('/api/webauthn/register-options', { method: 'POST' });
      if (!optionsResponse.ok) {
        const data = await optionsResponse.json().catch(() => ({}));
        throw new Error(data.error ?? 'Tidak dapat mulakan pendaftaran fingerprint.');
      }
      const optionsJSON = await optionsResponse.json();

      const attestationResponse = await startRegistration({ optionsJSON });

      const deviceName = typeof navigator !== 'undefined' && /iphone|ipad/i.test(navigator.userAgent)
        ? 'iPhone/iPad'
        : typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
          ? 'Android'
          : 'Peranti ini';

      const verifyResponse = await fetch('/api/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: attestationResponse, name: deviceName }),
      });

      const data = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok) {
        throw new Error(data.error ?? 'Pendaftaran fingerprint gagal.');
      }

      toast({
        title: 'Fingerprint Didaftarkan',
        description: 'Kini anda boleh log masuk menggunakan fingerprint/Face ID pada peranti ini.',
      });
      await loadCredentials();
    } catch (err) {
      const message = (err as Error).name === 'NotAllowedError'
        ? 'Pendaftaran fingerprint dibatalkan.'
        : (err as Error).message || 'Pendaftaran fingerprint gagal.';
      toast({
        title: 'Pendaftaran Gagal',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeleteCredential = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/webauthn/credentials/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Tidak dapat memadam fingerprint ini.');
      }
      await loadCredentials();
      toast({ title: 'Fingerprint Dipadam', description: 'Peranti tersebut tidak lagi boleh log masuk dengan fingerprint.' });
    } catch (err) {
      toast({ title: 'Padam Gagal', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  if (!user) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const payload: {
      firstName: string;
      lastName: string;
      email: string;
      password?: string;
    } = {
      firstName,
      lastName,
      email,
      ...(password ? { password } : {}),
    };

    const response = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast({
        title: 'Kemaskini Profil Gagal',
        description: data.error ?? 'Profil anda tidak dapat dikemaskini buat masa ini.',
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    const responseData = await response.json();
    login(responseData.user); // Refresh context
    
    toast({
      title: "Profil Dikemaskini",
      description: "Maklumat anda berjaya disimpan.",
    });
    
    setPassword('');
    setIsSaving(false);
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <PageHeader 
        title="Profil Saya" 
        description="Urus maklumat peribadi dan tetapan keselamatan anda."
      />

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <Card className="border-none shadow-sm flex flex-col items-center text-center p-6">
            <div className="h-24 w-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-bold mb-4 shadow-lg ring-4 ring-primary/10">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <h3 className="text-xl font-bold">{user.firstName} {user.lastName}</h3>
            <div className="flex items-center gap-1.5 mt-2 bg-secondary px-3 py-1 rounded-full text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {user.role === 'admin' ? <Shield size={12} className="text-primary" /> : <UserCircle size={12} />}
              {user.role}
            </div>
            <div className="mt-6 w-full text-left space-y-3">
              <div className="text-xs">
                <span className="text-muted-foreground block">Nama Pengguna</span>
                <span className="font-mono">{user.username}</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground block">Ahli Sejak</span>
                <span>{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleUpdate}>
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle>Butiran Peribadi</CardTitle>
                <CardDescription>Kemaskini nama dan emel utama anda.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nama Pertama</Label>
                    <Input 
                      id="firstName" 
                      value={firstName} 
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nama Akhir</Label>
                    <Input 
                      id="lastName" 
                      value={lastName} 
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Alamat Emel</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardHeader className="pt-0 border-t border-muted/30">
                <CardTitle className="text-lg mt-4 flex items-center gap-2">
                  <KeyRound size={20} className="text-primary" />
                  Security
                </CardTitle>
                <CardDescription>Tukar kata laluan untuk mengekalkan keselamatan akaun.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Kata Laluan Baharu</Label>
                  <PasswordInput 
                    id="password" 
                    placeholder="Biarkan kosong jika kekal semasa" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Disyorkan sekurang-kurangnya 12 aksara dengan gabungan huruf besar dan kecil.</p>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/30 pt-6">
                <Button type="submit" className="ml-auto gap-2" disabled={isSaving}>
                  <Save size={18} />
                  {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </CardFooter>
            </Card>
          </form>

          {webAuthnSupported && (
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Fingerprint size={20} className="text-primary" />
                  Log Masuk Fingerprint / Face ID
                </CardTitle>
                <CardDescription>
                  Daftarkan peranti ini supaya boleh log masuk terus guna fingerprint atau Face ID, tanpa taip password.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoadingCredentials ? (
                  <p className="text-sm text-muted-foreground">Memuatkan...</p>
                ) : credentials.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada peranti didaftarkan.</p>
                ) : (
                  credentials.map((cred) => (
                    <div
                      key={cred.id}
                      className="flex items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Smartphone size={18} className="text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{cred.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Didaftar {new Date(cred.createdAt).toLocaleDateString()}
                            {cred.lastUsedAt && ` · Digunakan kali terakhir ${new Date(cred.lastUsedAt).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive shrink-0"
                        onClick={() => handleDeleteCredential(cred.id)}
                        disabled={deletingId === cred.id}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
              <CardFooter className="bg-muted/30 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="ml-auto gap-2"
                  onClick={handleRegisterFingerprint}
                  disabled={isRegistering}
                >
                  <Fingerprint size={18} />
                  {isRegistering ? 'Mendaftar...' : 'Daftar Peranti Ini'}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}