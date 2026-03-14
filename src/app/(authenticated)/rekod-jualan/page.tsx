"use client";

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth-context';
import { Download, Plus, Trash2, ToggleLeft, ToggleRight, Upload } from 'lucide-react';
import { buildModulePerkara, buildSebutHargaTitle } from '@/lib/module-text';

type RekodJualanItem = {
  id: string;
  perkara: string;
  tajuk: string;
  semester: number;
  tahun: number;
  edisi: number;
  hargaSeunit: number;
  catatan: string;
  aktif: number;
  createdAt: string;
  jumlahTempahan: number;
  jumlahUnit: number;
  jumlahHasil: number;
  jumlahKV: number;
};

const emptyPenerbitanForm = {
  perkara: '',
  semester: '1',
  tahun: String(new Date().getFullYear()),
  hargaSeunit: '0',
  catatan: '',
};

const toCurrency = (value: number) =>
  `RM ${value.toFixed(2)}`;

const normalizeRekod = (item: Record<string, unknown>): RekodJualanItem => ({
  id: String(item.id ?? ''),
  perkara: String(item.perkara ?? ''),
  tajuk: String(item.tajuk ?? ''),
  semester: Number(item.semester ?? 0),
  tahun: Number(item.tahun ?? 0),
  edisi: Number(item.edisi ?? 1),
  hargaSeunit: Number(item.hargaSeunit ?? 0),
  catatan: String(item.catatan ?? ''),
  aktif: Number(item.aktif ?? 0),
  createdAt: String(item.createdAt ?? ''),
  jumlahTempahan: Number(item.jumlahTempahan ?? 0),
  jumlahUnit: Number(item.jumlahUnit ?? 0),
  jumlahHasil: Number(item.jumlahHasil ?? 0),
  jumlahKV: Number(item.jumlahKV ?? 0),
});

export default function RekodJualanPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rekod, setRekod] = useState<RekodJualanItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyPenerbitanForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadRekod = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/rekod-jualan', { cache: 'no-store' });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast({ title: 'Gagal Muatkan Rekod', description: (err as { error?: string }).error ?? `Status ${response.status}`, variant: 'destructive' });
        return;
      }
      const data = await response.json();
      setRekod(Array.isArray(data.rekod) ? data.rekod.map(normalizeRekod) : []);
    } catch {
      toast({ title: 'Gagal Muatkan Rekod', description: 'Ralat rangkaian.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRekod();
  }, []);

  const handleCreate = async () => {
    if (isCreating) return;
    if (!form.perkara.trim()) {
      toast({ title: 'Nama modul diperlukan', variant: 'destructive' });
      return;
    }

    const semester = Number(form.semester);
    const tahun = Number(form.tahun);
    const perkaraPenuh = buildModulePerkara(form.perkara.trim(), semester, tahun);
    const tajukAuto = buildSebutHargaTitle(perkaraPenuh);

    setIsCreating(true);
    try {
      const response = await fetch('/api/penerbitan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          perkara: perkaraPenuh,
          tajuk: tajukAuto,
          semester,
          tahun,
          edisi: 1,
          hargaSeunit: Number(form.hargaSeunit),
          catatan: form.catatan.trim(),
          aktif: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast({
          title: 'Cipta Gagal',
          description: (data as { error?: string }).error ?? 'Tidak dapat cipta penerbitan.',
          variant: 'destructive',
        });
        return;
      }

      setForm(emptyPenerbitanForm);
      setShowForm(false);
      await loadRekod();
      toast({ title: 'Penerbitan Ditambah', description: 'Penerbitan baru berjaya ditambah.' });
    } catch {
      toast({ title: 'Cipta Gagal', description: 'Ralat rangkaian.', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleAktif = async (id: string, currentAktif: number) => {
    if (togglingId) return;
    setTogglingId(id);
    try {
      const response = await fetch(`/api/penerbitan/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktif: currentAktif !== 1 }),
      });
      if (!response.ok) {
        toast({ title: 'Kemaskini Gagal', variant: 'destructive' });
        return;
      }
      await loadRekod();
      toast({ title: currentAktif === 1 ? 'Penerbitan Dinyahaktifkan' : 'Penerbitan Diaktifkan' });
    } catch {
      toast({ title: 'Kemaskini Gagal', variant: 'destructive' });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    const confirmed = window.confirm(
      'Padam penerbitan ini? Rekod jualan yang berkaitan tidak akan terpadam.'
    );
    if (!confirmed) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/penerbitan/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        toast({ title: 'Padam Gagal', variant: 'destructive' });
        return;
      }
      await loadRekod();
      toast({ title: 'Penerbitan Dipadam' });
    } catch {
      toast({ title: 'Padam Gagal', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadTemplate = () => {
    window.location.href = '/api/rekod-jualan/template';
  };

  const handlePickImportFile = () => {
    importFileRef.current?.click();
  };

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isImporting) return;

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/rekod-jualan/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({
          title: 'Import Gagal',
          description: (data as { error?: string }).error ?? 'Tidak dapat import fail XLSX.',
          variant: 'destructive',
        });
        return;
      }

      await loadRekod();
      const results = (data as { results?: { success?: number; updated?: number; failed?: number } }).results;
      toast({
        title: 'Import Selesai',
        description: `Tambah: ${results?.success ?? 0}, kemas kini: ${results?.updated ?? 0}, gagal: ${results?.failed ?? 0}.`,
      });
    } catch {
      toast({
        title: 'Import Gagal',
        description: 'Ralat rangkaian semasa import rekod jualan.',
        variant: 'destructive',
      });
    } finally {
      event.target.value = '';
      setIsImporting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Rekod Jualan"
        description="Urus penerbitan modul dan lihat ringkasan jualan per penerbitan."
      />

      {isAdmin && (
        <Card className="border-none shadow-sm mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pengurusan Penerbitan</CardTitle>
                <CardDescription>Tambah atau urus senarai edisi penerbitan modul.</CardDescription>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={handleImportFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={handleDownloadTemplate}
                >
                  <Download size={16} />
                  Download Template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={handlePickImportFile}
                  disabled={isImporting}
                >
                  <Upload size={16} />
                  {isImporting ? 'Importing...' : 'Upload XLSX'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowForm((v) => !v)}
                  variant="outline"
                  className="gap-2"
                >
                  <Plus size={16} />
                  {showForm ? 'Tutup Borang' : 'Tambah Penerbitan'}
                </Button>
              </div>
            </div>
          </CardHeader>

          {showForm && (
            <CardContent className="border-t pt-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2 md:col-span-2 lg:col-span-2">
                  <Label>Nama Modul Asas</Label>
                  <Input
                    placeholder="Contoh: MODUL PRAKTIS BAHASA MELAYU"
                    value={form.perkara}
                    onChange={(e) => setForm((f) => ({ ...f, perkara: e.target.value.toUpperCase() }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sistem akan jana automatik: {"[NAMA MODUL] SEMESTER X (KOHORT TAHUN) KOLEJ VOKASIONAL"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Semester</Label>
                  <Select
                    value={form.semester}
                    onValueChange={(v) => setForm((f) => ({ ...f, semester: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Semester 1</SelectItem>
                      <SelectItem value="2">Semester 2</SelectItem>
                      <SelectItem value="3">Semester 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Kohort</Label>
                  <Input
                    type="number"
                    min="2020"
                    max="2099"
                    value={form.tahun}
                    onChange={(e) => setForm((f) => ({ ...f, tahun: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Harga Seunit (RM)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.hargaSeunit}
                    onChange={(e) => setForm((f) => ({ ...f, hargaSeunit: e.target.value }))}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Catatan (Pilihan)</Label>
                  <Input
                    value={form.catatan}
                    onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))}
                    placeholder="Catatan tambahan"
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button type="button" onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? 'Menyimpan...' : 'Simpan Penerbitan'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setForm(emptyPenerbitanForm);
                  }}
                >
                  Batal
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Rekod Jualan Per Penerbitan</CardTitle>
          <CardDescription>
            {isLoading
              ? 'Memuatkan...'
              : `${rekod.length} penerbitan terdaftar.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Modul (Perkara)</TableHead>
                  <TableHead>Sem</TableHead>
                  <TableHead>Kohort</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">Unit Terjual</TableHead>
                  <TableHead className="text-right">Hasil (RM)</TableHead>
                  <TableHead className="text-right">Bil. KV</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Tindakan</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rekod.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isAdmin ? 9 : 8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {isLoading
                        ? 'Memuatkan rekod jualan...'
                        : isAdmin
                          ? 'Belum ada penerbitan. Klik butang "Tambah Penerbitan" di atas untuk mula.'
                          : 'Tiada rekod jualan buat masa ini. Sila hubungi Admin untuk tambah penerbitan.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  rekod.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium max-w-[320px] min-w-[220px]">
                        <div
                          title={item.perkara}
                          className="break-words leading-snug"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {item.perkara}
                        </div>
                        {item.catatan && (
                          <div className="text-xs text-muted-foreground truncate">
                            {item.catatan}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>Sem {item.semester}</TableCell>
                      <TableCell>{item.tahun}</TableCell>
                      <TableCell className="text-right">
                        {toCurrency(item.hargaSeunit)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.jumlahUnit}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {toCurrency(item.jumlahHasil)}
                      </TableCell>
                      <TableCell className="text-right">{item.jumlahKV}</TableCell>
                      <TableCell>
                        <Badge variant={item.aktif === 1 ? 'default' : 'secondary'}>
                          {item.aktif === 1 ? 'Aktif' : 'Tidak Aktif'}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleAktif(item.id, item.aktif)}
                              disabled={togglingId === item.id}
                              title={item.aktif === 1 ? 'Nyahaktifkan' : 'Aktifkan'}
                            >
                              {item.aktif === 1 ? (
                                <ToggleRight size={16} />
                              ) : (
                                <ToggleLeft size={16} />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => handleDelete(item.id)}
                              disabled={deletingId === item.id}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
