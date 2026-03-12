"use client";

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Save, X, Shield, User as UserIcon } from 'lucide-react';

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const userId = resolvedParams.id;
  const [user, setUser] = useState<User | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const loadUser = async () => {
      const response = await fetch(`/api/users/${userId}`, { cache: 'no-store' });
      if (!response.ok) {
        router.push('/admin/users');
        return;
      }

      const data = await response.json();
      const found: User = data.user;
      setUser(found);
      setFirstName(found.firstName);
      setLastName(found.lastName);
      setEmail(found.email);
      setRole(found.role);
    };

    loadUser();
  }, [userId, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);

    const payload: {
      firstName: string;
      lastName: string;
      email: string;
      role: UserRole;
      password?: string;
    } = {
      firstName,
      lastName,
      email,
      role,
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
        title: 'Kemaskini Gagal',
        description: data.error ?? 'Tidak dapat mengemaskini pengguna.',
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    toast({
      title: "Pengguna Dikemaskini",
      description: `Tetapan untuk ${firstName} berjaya dikemaskini.`,
    });
    router.push('/admin/users');
  };

  if (!user) return null;

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <PageHeader 
        title="Edit Akaun Pengguna" 
        description={`Ubah tahap akses dan butiran untuk ${user.username}.`}
      />

      <form onSubmit={handleSave}>
        <div className="grid gap-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Butiran Pengguna</CardTitle>
              <CardDescription>Maklumat identiti teras.</CardDescription>
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
              <div className="space-y-2">
                <Label htmlFor="role">Kebenaran Peranan</Label>
                <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <UserIcon size={14} />
                        Pengguna Biasa
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield size={14} />
                        Pentadbir
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Tetap Semula Kata Laluan</CardTitle>
              <CardDescription>Paksa penukaran kata laluan untuk pengguna ini.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="password">Kata Laluan Baharu</Label>
                <PasswordInput 
                  id="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Biarkan kosong jika tiada perubahan"
                  className="font-mono"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            <X size={18} className="mr-2" /> Batal
          </Button>
          <Button type="submit" className="gap-2 h-11 px-8" disabled={isSaving}>
            <Save size={18} />
            {isSaving ? "Menyimpan..." : "Kemaskini Akaun"}
          </Button>
        </div>
      </form>
    </div>
  );
}