"use client";

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useAuth } from '@/components/auth-context';
import { BarChart2, BookUser, FileText, Hash, Key, ListPlus, ReceiptText, ShieldCheck, Upload, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';

type ReceiptSummaryResponse = {
  receipts?: Array<{ id: string }>;
  nextNoResit?: string;
  nextNoSeriSebatHarga?: string;
};

type CustomerSummaryResponse = {
  customers?: Array<{ id: string }>;
};

type DraftTempahanResponse = {
  drafts?: Array<{ id: string }>;
  status?: string;
};

type PenerbitanRecord = {
  semester: number;
  tahun: number;
  jumlahHasil: number;
};

const ALL_YEARS = 'all';

const formatRM = (value: number) =>
  `RM ${value.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const hasilChartConfig = {
  jumlahHasil: {
    label: 'Hasil Jualan',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

export default function DashboardPage() {
  const { user } = useAuth();
  const [jumlahPelanggan, setJumlahPelanggan] = useState(0);
  const [jumlahDraftResit, setJumlahDraftResit] = useState(0);
  const [jumlahPenerbitanAktif, setJumlahPenerbitanAktif] = useState(0);
  const [nextNoResit, setNextNoResit] = useState('-');
  const [nextNoSebutHarga, setNextNoSebutHarga] = useState('-');
  const [penerbitanRekod, setPenerbitanRekod] = useState<PenerbitanRecord[]>([]);
  const [tahunFilter, setTahunFilter] = useState<string>(ALL_YEARS);

  useEffect(() => {
    const loadDashboardData = async () => {
      const [customerResponse, tempahanResponse, receiptResponse, rekodResponse] = await Promise.all([
        fetch('/api/customers', { cache: 'no-store' }),
        fetch('/api/tempahan/drafts?status=active', { cache: 'no-store' }),
        fetch('/api/receipts', { cache: 'no-store' }),
        fetch('/api/rekod-jualan', { cache: 'no-store' }),
      ]);

      if (customerResponse.ok) {
        const customerData = (await customerResponse.json()) as CustomerSummaryResponse;
        setJumlahPelanggan(customerData.customers?.length ?? 0);
      }

      if (tempahanResponse.ok) {
        const tempahanData = (await tempahanResponse.json()) as DraftTempahanResponse;
        setJumlahDraftResit(tempahanData.drafts?.length ?? 0);
      }

      if (receiptResponse.ok) {
        const receiptData = (await receiptResponse.json()) as ReceiptSummaryResponse;
        setNextNoResit(receiptData.nextNoResit ?? '-');
        setNextNoSebutHarga(receiptData.nextNoSeriSebatHarga ?? '-');
      }

      if (rekodResponse.ok) {
        const rekodData = (await rekodResponse.json()) as {
          rekod?: Array<{ aktif: number; semester: number; tahun: number; jumlahHasil: number }>;
        };
        const aktif = (rekodData.rekod ?? []).filter((r) => r.aktif === 1).length;
        setJumlahPenerbitanAktif(aktif);
        setPenerbitanRekod(
          (rekodData.rekod ?? []).map((r) => ({
            semester: Number(r.semester ?? 0),
            tahun: Number(r.tahun ?? 0),
            jumlahHasil: Number(r.jumlahHasil ?? 0),
          }))
        );
      }
    };

    void loadDashboardData();
  }, []);

  const tahunOptions = useMemo(() => {
    const years = new Set(penerbitanRekod.map((r) => r.tahun).filter((t) => t > 0));
    return Array.from(years).sort((a, b) => b - a);
  }, [penerbitanRekod]);

  const hasilPerSemester = useMemo(() => {
    const totals = new Map<number, number>([
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ]);

    const filtered =
      tahunFilter === ALL_YEARS
        ? penerbitanRekod
        : penerbitanRekod.filter((r) => String(r.tahun) === tahunFilter);

    for (const r of filtered) {
      if (totals.has(r.semester)) {
        totals.set(r.semester, (totals.get(r.semester) ?? 0) + r.jumlahHasil);
      }
    }

    return Array.from(totals.entries()).map(([semester, jumlahHasil]) => ({
      semester: `Semester ${semester}`,
      jumlahHasil,
    }));
  }, [penerbitanRekod, tahunFilter]);

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
        description="Ringkasan sistem KVar3.1 dan aktiviti terkini."
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

      <Card className="border-none shadow-sm mb-8">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Hasil Jualan Mengikut Semester</CardTitle>
            <CardDescription>Jumlah hasil (RM) dari penerbitan, dikumpul ikut semester.</CardDescription>
          </div>
          <Select value={tahunFilter} onValueChange={setTahunFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Tahun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_YEARS}>Semua Tahun</SelectItem>
              {tahunOptions.map((tahun) => (
                <SelectItem key={tahun} value={String(tahun)}>
                  {tahun}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <ChartContainer config={hasilChartConfig} className="aspect-auto h-[260px] w-full">
            <BarChart data={hasilPerSemester} margin={{ top: 20 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="semester"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent formatter={(value) => formatRM(Number(value))} />}
              />
              <Bar dataKey="jumlahHasil" fill="var(--color-jumlahHasil)" radius={[4, 4, 0, 0]} maxBarSize={64}>
                <LabelList
                  dataKey="jumlahHasil"
                  position="top"
                  className="fill-foreground"
                  fontSize={12}
                  formatter={(value: number) => formatRM(value)}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Tindakan Pantas</CardTitle>
            <CardDescription>Akses modul utama dengan pantas.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button asChild className="justify-start gap-2">
              <Link href="/resit-1">
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
            <CardDescription>Butiran konfigurasi KVar3.1 semasa.</CardDescription>
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