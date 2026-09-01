"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Save, X } from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+60', name: 'Malaysia', flag: '🇲🇾', display: '60' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬', display: '65' },
  { code: '+62', name: 'Indonesia', flag: '🇮🇩', display: '62' },
  { code: '+66', name: 'Thailand', flag: '🇹🇭', display: '66' },
  { code: '+63', name: 'Philippines', flag: '🇵🇭', display: '63' },
  { code: '+84', name: 'Vietnam', flag: '🇻🇳', display: '84' },
  { code: '+673', name: 'Brunei', flag: '🇧🇳', display: '673' },
];

export default function CreateCustomerPage() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [countryCode, setCountryCode] = useState('+60');
  const [phone, setPhone] = useState('');
  const [kodKV, setKodKV] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const router = useRouter();
  const { toast } = useToast();

  const handlePhoneChange = (value: string) => {
    // Buang semua yang bukan nombor
    let cleaned = value.replace(/\D/g, '');
    
    // Sekat jika cuba letak 0 di depan
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    setPhone(cleaned);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // Gabungkan country code dengan phone number (tanpa tanda +)
    const cleanCode = countryCode.replace('+', '');
    const fullPhoneNumber = `${cleanCode}${phone}`;

    const response = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        address,
        postcode,
        phone: fullPhoneNumber,
        kodKV,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast({
        title: 'Cipta Gagal',
        description: data.error ?? 'Tidak dapat mencipta pelanggan.',
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    toast({
      title: 'Pelanggan Dicipta',
      description: `Pelanggan ${name} berjaya ditambah.`,
    });
    router.push('/customers');
  };

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <PageHeader
        title="Cipta Pelanggan Baharu"
        description="Tambah pelanggan baharu ke pangkalan data."
      />

      <form onSubmit={handleSave}>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
            <CardDescription>Masukkan butiran pelanggan di bawah.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama pelanggan"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Alamat</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Alamat penuh"
                required
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  placeholder="Postcode"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <div className="flex gap-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_CODES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          <span className="flex items-center gap-2">
                            <span>{country.flag}</span>
                            <span>{country.display}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="123456789"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Nombor sahaja, tanpa 0 di depan.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kodKV">Kod KV</Label>
              <Input
                id="kodKV"
                value={kodKV}
                onChange={(e) => setKodKV(e.target.value)}
                placeholder="Unique Kod KV"
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Kod KV boleh berulang untuk pelanggan yang berbeza.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            <X size={18} className="mr-2" /> Batal
          </Button>
          <Button type="submit" className="gap-2 h-11 px-8" disabled={isSaving}>
            <Save size={18} />
            {isSaving ? 'Mencipta...' : 'Cipta Pelanggan'}
          </Button>
        </div>
      </form>
    </div>
  );
}
