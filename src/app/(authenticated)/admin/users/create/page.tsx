"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserRole } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Save, X, RefreshCw } from 'lucide-react';
import { generateSecureCredentials } from '@/ai/flows/generate-secure-credentials-flow';

export default function CreateUserPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();

  const handleGenerateAI = async () => {
    if (!firstName || !lastName) {
      toast({
        title: "Maklumat Diperlukan",
        description: "Sila isi nama pertama dan nama akhir untuk guna penjana AI.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateSecureCredentials({ firstName, lastName, email });
      setUsername(result.username);
      setPassword(result.password);
      toast({
        title: "Kelayakan Dijana",
        description: "AI telah menjana nama pengguna standard dan kata laluan selamat.",
      });
    } catch (error) {
      toast({
        title: "Ralat AI",
        description: "Gagal menjana kelayakan. Sila cuba lagi.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // Simple validation
    if (!username || !password) {
      toast({
        title: "Borang Tidak Lengkap",
        description: "Nama pengguna dan kata laluan diperlukan.",
        variant: "destructive"
      });
      setIsSaving(false);
      return;
    }

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        username,
        password,
        role,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast({
        title: 'Cipta Gagal',
        description: data.error ?? 'Tidak dapat mencipta akaun pengguna.',
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    toast({
      title: "Pengguna Dicipta",
      description: `Akaun untuk ${firstName} ${lastName} berjaya ditambah.`,
    });
    router.push('/admin/users');
  };

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <PageHeader 
        title="Cipta Akaun Baharu" 
        description="Isi maklumat pengguna atau guna AI untuk tetapan selamat." 
      />

      <form onSubmit={handleSave}>
        <div className="grid gap-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Maklumat Peribadi</CardTitle>
              <CardDescription>Butiran asas pengguna.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nama Pertama</Label>
                  <Input 
                    id="firstName" 
                    value={firstName} 
                    onChange={(e) => setFirstName(e.target.value)} 
                    placeholder="Ali"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nama Akhir</Label>
                  <Input 
                    id="lastName" 
                    value={lastName} 
                    onChange={(e) => setLastName(e.target.value)} 
                    placeholder="Abu"
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
                  placeholder="john.doe@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Peranan Sistem</Label>
                <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih peranan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Pengguna Biasa</SelectItem>
                    <SelectItem value="admin">Pentadbir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden border-l-4 border-l-accent">
            <CardHeader className="bg-accent/5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Kelayakan Akses</CardTitle>
                  <CardDescription>Nama pengguna dan kata laluan untuk akses platform.</CardDescription>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 border-accent text-accent-foreground hover:bg-accent/10"
                  onClick={handleGenerateAI}
                  disabled={isGenerating}
                >
                  {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles size={16} />}
                  Jana AI
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Nama Pengguna</Label>
                <Input 
                  id="username" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="jdoe"
                  className="font-mono bg-secondary/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Kata Laluan Awal</Label>
                <PasswordInput 
                  id="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Kata laluan selamat dijana"
                  className="font-mono bg-secondary/30"
                />
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Keperluan: 12+ aksara, huruf besar-kecil bercampur, simbol</p>
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
            {isSaving ? "Mencipta..." : "Cipta Akaun Pengguna"}
          </Button>
        </div>
      </form>
    </div>
  );
}