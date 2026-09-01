"use client";

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Customer } from '@/lib/types';
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

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [countryCode, setCountryCode] = useState('+60');
  const [phone, setPhone] = useState('');
  const [kodKV, setKodKV] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const returnPage = searchParams.get('page') ?? '1';
  const returnQ = searchParams.get('q') ?? '';
  const returnFilter = searchParams.get('filter') ?? 'all';
  const returnQueryParams = new URLSearchParams();
  returnQueryParams.set('page', returnPage);
  if (returnQ.trim()) returnQueryParams.set('q', returnQ);
  if (returnFilter !== 'all') returnQueryParams.set('filter', returnFilter);
  const returnUrl = `/customers?${returnQueryParams.toString()}`;
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

  useEffect(() => {
    const loadCustomer = async () => {
      const response = await fetch(`/api/customers/${customerId}`, { cache: 'no-store' });
      if (!response.ok) {
        router.push(returnUrl);
        return;
      }

      const data = await response.json();
      const found: Customer = data.customer;
      setCustomer(found);
      setName(found.name);
      setAddress(found.address);
      setPostcode(found.postcode);
      
      // Parse phone number untuk pisahkan country code dan nombor
      const fullPhone = found.phone;
      let extractedCode = '+60';
      let extractedPhone = fullPhone;
      
      // Cari country code yang match (dengan atau tanpa +)
      for (const country of COUNTRY_CODES) {
        const codeWithPlus = country.code;
        const codeWithoutPlus = country.code.replace('+', '');
        
        if (fullPhone.startsWith(codeWithPlus)) {
          extractedCode = country.code;
          extractedPhone = fullPhone.substring(codeWithPlus.length);
          break;
        } else if (fullPhone.startsWith(codeWithoutPlus)) {
          extractedCode = country.code;
          extractedPhone = fullPhone.substring(codeWithoutPlus.length);
          break;
        }
      }
      
      setCountryCode(extractedCode);
      setPhone(extractedPhone);
      setKodKV(found.kodKV);
    };

    loadCustomer();
  }, [customerId, router, returnUrl]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setIsSaving(true);

    // Gabungkan country code dengan phone number (tanpa tanda +)
    const cleanCode = countryCode.replace('+', '');
    const fullPhoneNumber = `${cleanCode}${phone}`;

    const payload: Record<string, string> = {};
    if (name !== customer.name) payload.name = name;
    if (address !== customer.address) payload.address = address;
    if (postcode !== customer.postcode) payload.postcode = postcode;
    if (fullPhoneNumber !== customer.phone) payload.phone = fullPhoneNumber;
    if (kodKV !== customer.kodKV) payload.kodKV = kodKV;

    // Always send all fields to ensure complete update
    if (Object.keys(payload).length === 0) {
      toast({ title: 'Tiada Perubahan', description: 'Tiada maklumat yang diubah.' });
      setIsSaving(false);
      return;
    }

    const fullPayload = { name, address, postcode, kodKV, phone: fullPhoneNumber, ...payload };

    const response = await fetch(`/api/customers/${customer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPayload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast({
        title: 'Kemaskini Gagal',
        description: data.error ?? 'Tidak dapat mengemaskini pelanggan.',
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    toast({
      title: 'Pelanggan Dikemaskini',
      description: `Pelanggan ${name} berjaya dikemaskini.`,
    });
    router.push(returnUrl);
  };

  if (!customer) return null;

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <PageHeader
        title="Edit Pelanggan"
        description={`Ubah butiran untuk ${customer.name}.`}
      />

      <form onSubmit={handleSave}>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Butiran Pelanggan</CardTitle>
            <CardDescription>Kemaskini maklumat pelanggan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Alamat</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
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
          <Button type="button" variant="ghost" onClick={() => router.push(returnUrl)}>
            <X size={18} className="mr-2" /> Batal
          </Button>
          <Button type="submit" className="gap-2 h-11 px-8" disabled={isSaving}>
            <Save size={18} />
            {isSaving ? 'Menyimpan...' : 'Kemaskini Pelanggan'}
          </Button>
        </div>
      </form>
    </div>
  );
}
