"use client";

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth-context';
import { BarChart2, BookUser, FileText, Hash, Key, ListPlus, ReceiptText, ShieldCheck, Upload, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type ReceiptSummaryResponse = {
  receipts?: Array<{ id: string }>;
  nextNoResit?: string;
  nextNoSeriSebatHarga?: string;
};

type CustomerSummaryResponse = {
  customers?: Array<{ id: string }>;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [jumlahPelanggan, setJumlahPelanggan] = useState(0);
  const [jumlahDraftResit, setJumlahDraftResit] = useState(0);
  const [jumlahPenerbitanAktif, setJumlahPenerbitanAktif] = useState(0);
  const [nextNoResit, setNextNoResit] = useState('-');
  const [nextNoSebutHarga, setNextNoSebutHarga] = useState('-');

  useEffect(() => {
    const loadDashboardData = async () => {
      const [customerResponse, receiptResponse, rekodResponse] = await Promise.all([
        fetch('/api/customers', { cache: 'no-store' }),
        fetch('/api/receipts', { cache: 'no-store' }),
        fetch('/api/rekod-jualan', { cache: 'no-store' }),
      ]);

      if (customerResponse.ok) {
        const customerData = (await customerResponse.json()) as CustomerSummaryResponse;
        setJumlahPelanggan(customerData.customers?.length ?? 0);
      }

      if (receiptResponse.ok) {
        const receiptData = (await receiptResponse.json()) as ReceiptSummaryResponse;
        setJumlahDraftResit(receiptData.receipts?.length ?? 0);
        setNextNoResit(receiptData.nextNoResit ?? '-');
        setNextNoSebutHarga(receiptData.nextNoSeriSebatHarga ?? '-');
      }

      if (rekodResponse.ok) {
        const rekodData = (await rekodResponse.json()) as { rekod?: Array<{ aktif: number }> };
        const aktif = (rekodData.rekod ?? []).filter((r) => r.aktif === 1).length;
        setJumlahPenerbitanAktif(aktif);
      }
    };

    void loadDashboardData();
  }, []);

  const stats = [
    {
      title: 'Jumlah Pelanggan',
      value: jumlahPelanggan.toString(),
      icon: BookUser,
      description: 'Jumlah pelanggan berdaftar',
      color: "text-blue-600 bg-blue-100",
    },
    {
      title: 'Draf Resit',
      value: jumlahDraftResit.toString(),
      icon: FileText,
      description: 'Bilangan draf belum dieksport',
      color: "text-purple-600 bg-purple-100",
    },
    {
      title: 'No Siri Resit Semasa',
      value: nextNoResit,
      icon: Hash,
      description: 'Nombor seterusnya untuk resit',
      color: "text-green-600 bg-green-100",
    },
    {
      title: 'No Siri Sebut Harga',
      value: nextNoSebutHarga,
      icon: ReceiptText,
      description: 'Nombor seterusnya untuk sebut harga',
      color: "text-orange-600 bg-orange-100",
    },
    {
      title: 'Penerbitan Aktif',
      value: jumlahPenerbitanAktif.toString(),
      icon: BarChart2,
      description: 'Edisi modul yang sedang aktif dijual',
      color: "text-teal-600 bg-teal-100",
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title={`Selamat kembali, ${user?.firstName}`}
        description="Ringkasan sistem KVar3.0 dan aktiviti terkini."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon size={16} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Tindakan Pantas</CardTitle>
            <CardDescription>Akses modul utama dengan pantas.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button asChild className="justify-start gap-2">
              <Link href="/receipts">
                <ReceiptText size={16} />
                Buka Resit
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start gap-2">
              <Link href="/data-parcel">
                <ListPlus size={16} />
                Buka Data Parcel
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start gap-2">
              <Link href="/customers/create">
                <UserPlus size={16} />
                Tambah Pelanggan
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start gap-2">
              <Link href="/customers/import">
                <Upload size={16} />
                Import Pelanggan
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Maklumat Sistem</CardTitle>
            <CardDescription>Butiran konfigurasi KVar3.0 semasa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Versi Aplikasi</span>
              <span className="text-sm font-medium">v1.0.4-stable</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Protokol Keselamatan</span>
              <span className="text-sm font-medium">RBAC + AES-256 (Sim)</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-muted-foreground">Pangkalan Data Aktif</span>
              <span className="text-sm font-medium">SQLite (Local)</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Tip Keselamatan Ringkas</CardTitle>
            <CardDescription>Kekalkan amalan keselamatan yang baik.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Key className="text-primary mt-1" size={18} />
              <div>
                <p className="text-sm font-medium">Tukar Kata Laluan Secara Berkala</p>
                <p className="text-xs text-muted-foreground">Pentadbir digalakkan menukar kelayakan akaun sensitif setiap 90 hari.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <ShieldCheck className="text-primary mt-1" size={18} />
              <div>
                <p className="text-sm font-medium">Audit Akses Pengguna</p>
                <p className="text-xs text-muted-foreground">Semak peranan pengguna secara berkala untuk amalkan akses minimum yang perlu.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}