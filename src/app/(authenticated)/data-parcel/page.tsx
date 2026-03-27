"use client";

import { useEffect, useMemo, useState } from 'react';
import { Archive, Download, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { KVAutocomplete } from '@/components/kv-autocomplete';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type KVSelection = {
  id: string;
  name: string;
  address: string;
  postcode: string;
  phone: string;
  kodKV: string;
};

type ParcelEntry = {
  id: string;
  namaCustomer: string;
  alamat: string;
  poskod: string;
  kv: string;
  noPhone: string;
  noOrder: string;
  bilanganParcel: number;
  source: 'tempahan' | 'manual';
};

const emptyForm = {
  namaCustomer: '',
  alamat: '',
  poskod: '',
  kv: '',
  noPhone: '',
  noOrder: '',
  bilanganParcel: '1',
};

export default function DataParcelPage() {
  const [form, setForm] = useState(emptyForm);
  const [entries, setEntries] = useState<ParcelEntry[]>([]);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [isUpdatingParcelId, setIsUpdatingParcelId] = useState<string | null>(null);
  const [isUpdatingSelectedStatus, setIsUpdatingSelectedStatus] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadDrafts = async () => {
    setIsLoadingDrafts(true);
    try {
      const response = await fetch(`/api/data-parcel/drafts?status=${activeTab}`, { cache: 'no-store' });
      if (!response.ok) {
        setEntries([]);
        return;
      }

      const data = await response.json();
      const drafts = Array.isArray(data.drafts) ? data.drafts : [];
      const mapped: ParcelEntry[] = drafts.map((item: Record<string, unknown>) => ({
        id: String(item.id ?? ''),
        namaCustomer: String(item.namaCustomer ?? ''),
        alamat: String(item.alamat ?? ''),
        poskod: String(item.poskod ?? ''),
        kv: String(item.kv ?? ''),
        noPhone: String(item.noPhone ?? ''),
        noOrder: String(item.noOrder ?? ''),
        bilanganParcel: Number(item.bilanganParcel ?? 1),
        source: 'manual',
      }));

      setEntries(mapped);
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  useEffect(() => {
    loadDrafts();
  }, [activeTab]);

  const totalParcel = useMemo(
    () => entries.reduce((sum, item) => sum + item.bilanganParcel, 0),
    [entries]
  );

  useEffect(() => {
    const entryIdSet = new Set(entries.map((entry) => entry.id));
    setSelectedEntryIds((prev) => prev.filter((id) => entryIdSet.has(id)));
  }, [entries]);

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedEntryIds.includes(entry.id)),
    [entries, selectedEntryIds]
  );

  const allSelected = entries.length > 0 && selectedEntryIds.length === entries.length;

  const updateForm = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSelectKV = (item: KVSelection) => {
    setForm((current) => ({
      ...current,
      namaCustomer: item.name,
      alamat: item.address,
      poskod: item.postcode,
      kv: item.kodKV,
      noPhone: item.phone,
    }));
  };

  const handleSelectNamaCustomer = (item: KVSelection) => {
    setForm((current) => ({
      ...current,
      namaCustomer: item.name,
      alamat: item.address,
      poskod: item.postcode,
      kv: item.kodKV,
      noPhone: item.phone,
    }));
  };

  const handleSaveToList = async () => {
    if (isSavingDraft) return;

    const bilanganParcel = Number(form.bilanganParcel);
    const missingFields: string[] = [];

    if (!form.namaCustomer.trim()) missingFields.push('Nama Pelanggan');
    if (!form.kv.trim()) missingFields.push('KV');
    if (!form.noPhone.trim()) missingFields.push('No. Telefon');
    if (!form.noOrder.trim()) missingFields.push('No Order');
    if (!form.bilanganParcel.trim()) missingFields.push('Bilangan Parcel');

    if (missingFields.length > 0) {
      toast({
        title: 'Form belum lengkap',
        description: `Sila lengkapkan: ${missingFields.join(', ')}.`,
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isInteger(bilanganParcel) || bilanganParcel < 1) {
      toast({
        title: 'Bilangan Parcel tidak sah',
        description: 'Bilangan Parcel mesti nombor 1 atau lebih.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingDraft(true);
    try {
      const response = await fetch('/api/data-parcel/drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          namaCustomer: form.namaCustomer.trim(),
          alamat: form.alamat.trim(),
          poskod: form.poskod.trim(),
          kv: form.kv.trim(),
          noPhone: form.noPhone.trim(),
          noOrder: form.noOrder.trim(),
          bilanganParcel,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast({
          title: 'Simpan gagal',
          description: data.error ?? 'Tidak dapat simpan draft data parcel.',
          variant: 'destructive',
        });
        return;
      }

      await loadDrafts();
      setForm(emptyForm);
      toast({
        title: 'Data disimpan ke senarai',
        description: 'Data parcel berjaya disimpan sebagai draft.',
      });
    } catch {
      toast({
        title: 'Simpan gagal',
        description: 'Ralat network/server semasa simpan draft data parcel.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleUpdateBilanganParcel = async (entryId: string, rawValue: string) => {
    if (activeTab !== 'active') return;

    const bilanganParcel = Number(rawValue);
    if (!Number.isInteger(bilanganParcel) || bilanganParcel < 1) {
      toast({
        title: 'Bilangan Parcel tidak sah',
        description: 'Bilangan Parcel mesti nombor bulat 1 atau lebih.',
        variant: 'destructive',
      });
      await loadDrafts();
      return;
    }

    const current = entries.find((entry) => entry.id === entryId);
    if (!current || current.bilanganParcel === bilanganParcel) return;

    setIsUpdatingParcelId(entryId);
    try {
      const response = await fetch(`/api/data-parcel/drafts/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bilanganParcel }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast({
          title: 'Kemaskini gagal',
          description: data.error ?? 'Tidak dapat kemaskini Bilangan Parcel.',
          variant: 'destructive',
        });
        await loadDrafts();
        return;
      }

      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === entryId ? { ...entry, bilanganParcel } : entry
        )
      );
    } catch {
      toast({
        title: 'Kemaskini gagal',
        description: 'Ralat network/server semasa kemaskini Bilangan Parcel.',
        variant: 'destructive',
      });
      await loadDrafts();
    } finally {
      setIsUpdatingParcelId(null);
    }
  };

  const handleExportSelectedXlsx = async () => {
    if (selectedEntries.length === 0 || isExporting) return;

    setIsExporting(true);
    try {
      const response = await fetch('/api/data-parcel/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entries: selectedEntries.map((entry) => ({
            namaCustomer: entry.namaCustomer,
            alamat: entry.alamat,
            poskod: entry.poskod,
            noPhone: entry.noPhone,
            noOrder: entry.noOrder,
            bilanganParcel: entry.bilanganParcel,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast({
          title: 'Export gagal',
          description: data.error ?? 'Tidak dapat mengeksport fail XLSX data parcel.',
          variant: 'destructive',
        });
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') ?? '';
      const matchedName = contentDisposition.match(/filename="?([^\"]+)"?/i)?.[1];
      const fileName = matchedName ?? `data-parcel-export-${Date.now()}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export berjaya',
        description: `Fail XLSX data parcel berjaya dijana untuk ${selectedEntries.length} entri dipilih.`,
      });
    } catch {
      toast({
        title: 'Export gagal',
        description: 'Ralat network/server semasa export data parcel.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpdateSelectedStatus = async () => {
    if (selectedEntryIds.length === 0 || isUpdatingSelectedStatus) return;

    const action = activeTab === 'active' ? 'archive' : 'restore';

    const confirmed = window.confirm(
      action === 'archive'
        ? `Arkibkan ${selectedEntryIds.length} draft yang dipilih?`
        : `Pulihkan ${selectedEntryIds.length} draft yang dipilih ke Semasa?`
    );
    if (!confirmed) return;

    setIsUpdatingSelectedStatus(true);
    try {
      const requests = selectedEntryIds.map((entryId) =>
        fetch(`/api/data-parcel/drafts/${entryId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
      );
      const results = await Promise.all(requests);
      const hasFailed = results.some((response) => !response.ok);

      if (hasFailed) {
        toast({
          title: action === 'archive' ? 'Arkib gagal' : 'Pulih gagal',
          description:
            action === 'archive'
              ? 'Sebahagian draft gagal diarkibkan. Sila cuba lagi.'
              : 'Sebahagian draft gagal dipulihkan. Sila cuba lagi.',
          variant: 'destructive',
        });
        return;
      }

      await loadDrafts();
      setSelectedEntryIds([]);
      toast({
        title: action === 'archive' ? 'Data diarkibkan' : 'Data dipulihkan',
        description:
          action === 'archive'
            ? 'Draft dipilih berjaya dipindahkan ke Sejarah.'
            : 'Draft dipilih berjaya dipindahkan ke Semasa.',
      });
    } catch {
      toast({
        title: action === 'archive' ? 'Arkib gagal' : 'Pulih gagal',
        description:
          action === 'archive'
            ? 'Ralat network/server semasa arkibkan draft dipilih.'
            : 'Ralat network/server semasa pulihkan draft dipilih.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingSelectedStatus(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedEntryIds.length === 0 || isDeletingSelected) return;

    setIsDeletingSelected(true);
    try {
      const requests = selectedEntryIds.map((entryId) =>
        fetch(`/api/data-parcel/drafts/${entryId}`, { method: 'DELETE' })
      );
      const results = await Promise.all(requests);
      const hasFailed = results.some((response) => !response.ok);

      if (hasFailed) {
        toast({
          title: 'Padam gagal',
          description: 'Sebahagian entri gagal dipadam. Sila cuba lagi.',
          variant: 'destructive',
        });
        return;
      }

      await loadDrafts();
      setSelectedEntryIds([]);
      toast({
        title: 'Entri dipadam',
        description: `${selectedEntryIds.length} entri berjaya dipadam.`,
      });
    } catch {
      toast({
        title: 'Padam gagal',
        description: 'Ralat network/server semasa memadam entri.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingSelected(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Data Parcel"
        description="Isi borang data parcel dan simpan ke senarai untuk pratonton sebelum eksport XLSX."
      />

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Borang Parcel</CardTitle>
            <CardDescription>Boleh cari dari DB guna Nama Pelanggan atau KV. No. Telefon auto isi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="namaCustomer">Nama Pelanggan</Label>
              <KVAutocomplete
                value={form.namaCustomer}
                onValueChange={(value) => updateForm('namaCustomer', value)}
                onKVSelect={handleSelectNamaCustomer}
                placeholder="Cari Nama Pelanggan"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kv">KV</Label>
              <KVAutocomplete
                value={form.kv}
                onValueChange={(value) => updateForm('kv', value)}
                onKVSelect={handleSelectKV}
                placeholder="Cari Kod KV"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="noPhone">No. Telefon</Label>
              <Input
                id="noPhone"
                value={form.noPhone}
                onChange={(e) => updateForm('noPhone', e.target.value)}
                placeholder="Auto isi selepas pilih KV"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="noOrder">No Order</Label>
              <Input
                id="noOrder"
                value={form.noOrder}
                onChange={(e) => updateForm('noOrder', e.target.value)}
                placeholder="Masukkan no order"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bilanganParcel">Bilangan Parcel</Label>
              <Input
                id="bilanganParcel"
                type="number"
                min="1"
                value={form.bilanganParcel}
                onChange={(e) => updateForm('bilanganParcel', e.target.value.replace(/\D/g, ''))}
                placeholder="Contoh: 3"
              />
            </div>

            <Button type="button" className="w-full" onClick={handleSaveToList} disabled={isSavingDraft}>
              {isSavingDraft ? 'Menyimpan...' : 'Simpan Ke Senarai'}
            </Button>
          </CardContent>
        </Card>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Padam {selectedEntryIds.length} entri?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak boleh dibatalkan. Entri yang dipilih akan dipadam secara kekal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteConfirm(false);
                handleDeleteSelected();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Padam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Senarai Preview Parcel</CardTitle>
            <CardDescription>
              {entries.length} entri dalam {activeTab === 'active' ? 'Semasa' : 'Sejarah'} | Jumlah parcel: {totalParcel}
            </CardDescription>
            <div className="pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={activeTab === 'active' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('active')}
                  className="w-full sm:w-auto"
                >
                  Semasa
                </Button>
                <Button
                  type="button"
                  variant={activeTab === 'archived' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('archived')}
                  className="w-full sm:w-auto"
                >
                  Sejarah
                </Button>
                <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto sm:justify-end">
                  <Button
                    type="button"
                    className="w-full gap-2 justify-start sm:w-auto sm:justify-center"
                    onClick={handleExportSelectedXlsx}
                    disabled={isExporting || selectedEntries.length === 0}
                  >
                    <Download size={16} />
                    {isExporting
                      ? 'Mengeksport...'
                      : `Export XLSX Dipilih (${selectedEntries.length})`}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 justify-start sm:w-auto sm:justify-center"
                    onClick={handleUpdateSelectedStatus}
                    disabled={isUpdatingSelectedStatus || selectedEntryIds.length === 0}
                  >
                    <Archive size={16} />
                    {isUpdatingSelectedStatus
                      ? activeTab === 'active'
                        ? 'Mengarkibkan...'
                        : 'Memulihkan...'
                      : activeTab === 'active'
                        ? `Arkibkan Dipilih (${selectedEntryIds.length})`
                        : `Pulihkan Dipilih (${selectedEntryIds.length})`}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full gap-2 justify-start sm:w-auto sm:justify-center"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isDeletingSelected || selectedEntryIds.length === 0}
                  >
                    <Trash2 size={16} />
                    {isDeletingSelected
                      ? 'Memadam...'
                      : `Padam Dipilih (${selectedEntryIds.length})`}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-12 text-center">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedEntryIds(entries.map((entry) => entry.id));
                            return;
                          }
                          setSelectedEntryIds([]);
                        }}
                        aria-label="Pilih semua entri"
                        disabled={entries.length === 0}
                      />
                    </TableHead>
                    <TableHead>Nama Pelanggan</TableHead>
                    <TableHead>KV</TableHead>
                    <TableHead>No. Telefon</TableHead>
                    <TableHead>No Order</TableHead>
                    <TableHead className="text-right">Bilangan Parcel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        {isLoadingDrafts
                          ? 'Memuatkan draft data parcel...'
                          : activeTab === 'active'
                            ? 'Belum ada data parcel semasa.'
                            : 'Belum ada sejarah data parcel.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedEntryIds.includes(item.id)}
                            onCheckedChange={(checked) => {
                              setSelectedEntryIds((prev) => {
                                if (checked) {
                                  if (prev.includes(item.id)) return prev;
                                  return [...prev, item.id];
                                }
                                return prev.filter((id) => id !== item.id);
                              });
                            }}
                            aria-label={`Pilih entri ${item.namaCustomer}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{item.namaCustomer}</TableCell>
                        <TableCell className="font-medium">{item.kv}</TableCell>
                        <TableCell>{item.noPhone}</TableCell>
                        <TableCell>{item.noOrder}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="1"
                            value={item.bilanganParcel}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              const next = value === '' ? 1 : Number(value);
                              setEntries((prev) =>
                                prev.map((entry) =>
                                  entry.id === item.id ? { ...entry, bilanganParcel: next } : entry
                                )
                              );
                            }}
                            onBlur={(e) => handleUpdateBilanganParcel(item.id, e.target.value)}
                            disabled={activeTab !== 'active' || isUpdatingParcelId === item.id}
                            className="ml-auto h-8 w-24 text-right"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Padam {selectedEntryIds.length} entri?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak boleh dibatalkan. Entri yang dipilih akan dipadam secara kekal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteConfirm(false);
                handleDeleteSelected();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Padam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
