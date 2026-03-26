"use client";

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { CustomerAutocomplete } from '@/components/customer-autocomplete';
import { KVAutocomplete } from '@/components/kv-autocomplete';
import { ReceiptDraft } from '@/lib/types';
import { Archive, Download, RefreshCcw, RotateCcw, Save, Trash2 } from 'lucide-react';

type ModuleOption = {
  id: string;
  perkara: string;
  hargaSeunit: number;
};

type CustomerLite = {
  id: string;
  name: string;
  kodKV: string;
  address?: string;
  postcode?: string;
  phone?: string;
};

type ResitDraftRow = ReceiptDraft & {
  source: 'receipts' | 'tempahan';
  tempahanDraftId?: string;
  status?: 'active' | 'archived';
  archivedAt?: string | null;
};

type TempahanDraftApiRow = {
  id: string;
  receiptDraftId: string;
  noResit: string;
  noSeriSebatHarga: string;
  namaPenerima: string;
  namaKolejVokasional: string;
  tajuk: string;
  perkara: string;
  kuantiti: number;
  hargaSeunit: number;
  hargaPostage: number;
  tarikh: string;
  semester: string;
  createdAt: string;
  updatedAt: string;
  status?: 'active' | 'archived';
  archivedAt?: string | null;
};

const toMoney = (value: number) => `RM ${value.toFixed(2)}`;

const getNoOrderFromNoResit = (noResitValue: string) => {
  const numeric = Number.parseInt(noResitValue.replace(/\D/g, ''), 10);
  if (Number.isNaN(numeric)) {
    return noResitValue.slice(-2).padStart(2, '0');
  }

  const value = numeric % 1000;
  const padLength = value >= 100 ? 3 : 2;
  return String(value).padStart(padLength, '0');
};

export default function ResitSatuPage() {
  const { toast } = useToast();

  const [noResit, setNoResit] = useState('0001');
  const [noSeriSebatHarga, setNoSeriSebatHarga] = useState('001');

  const [namaPenerima, setNamaPenerima] = useState('');
  const [noPhoneCustomer, setNoPhoneCustomer] = useState('');
  const [alamatCustomer, setAlamatCustomer] = useState('');
  const [poskodCustomer, setPoskodCustomer] = useState('');
  const [namaKolejVokasional, setNamaKolejVokasional] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [perkara, setPerkara] = useState('');
  const [hargaSeunit, setHargaSeunit] = useState('0');
  const [kuantiti, setKuantiti] = useState('1');
  const [hargaPostage, setHargaPostage] = useState('0');
  const [jumlahParcel, setJumlahParcel] = useState('1');
  const [tarikh, setTarikh] = useState(new Date().toISOString().slice(0, 10));

  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [drafts, setDrafts] = useState<ResitDraftRow[]>([]);

  const [isResetResitDialogOpen, setIsResetResitDialogOpen] = useState(false);
  const [isResetSebatHargaDialogOpen, setIsResetSebatHargaDialogOpen] = useState(false);
  const [resetResitNumber, setResetResitNumber] = useState('1');
  const [resetSebatHargaNumber, setResetSebatHargaNumber] = useState('1');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingResit, setIsResettingResit] = useState(false);
  const [isResettingSebatHarga, setIsResettingSebatHarga] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isDeletingDraftId, setIsDeletingDraftId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isArchivingSelected, setIsArchivingSelected] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [isRestoringSelected, setIsRestoringSelected] = useState(false);
  const [searchRekodLama, setSearchRekodLama] = useState('');

  const jumlahHarga = useMemo(() => {
    const qty = Number(kuantiti) || 0;
    const unit = Number(hargaSeunit) || 0;
    const postage = Number(hargaPostage) || 0;
    return qty * unit + postage;
  }, [kuantiti, hargaSeunit, hargaPostage]);

  const visibleDrafts = useMemo(() => {
    let filtered = drafts.filter((d) =>
      activeTab === 'active' ? d.status !== 'archived' : d.status === 'archived'
    );

    if (activeTab === 'archived' && searchRekodLama.trim()) {
      const query = searchRekodLama.trim().toLowerCase();
      filtered = filtered.filter((d) =>
        d.namaKolejVokasional.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [drafts, activeTab, searchRekodLama]);

  const refreshReceipts = async () => {
    const [receiptResponse, tempahanResponse] = await Promise.all([
      fetch(`/api/receipts?status=${activeTab}`, { cache: 'no-store' }),
      fetch(`/api/tempahan/drafts?status=${activeTab}`, { cache: 'no-store' }),
    ]);

    if (!receiptResponse.ok) {
      throw new Error('Gagal ambil data draf resit.');
    }

    const receiptData = await receiptResponse.json();
    setNoResit(receiptData.nextNoResit ?? '0001');
    setNoSeriSebatHarga(receiptData.nextNoSeriSebatHarga ?? '001');

    const receiptRows: ResitDraftRow[] = (Array.isArray(receiptData.receipts) ? receiptData.receipts : []).map(
      (draft: ReceiptDraft & { status?: string; archivedAt?: string | null }) => ({
        ...draft,
        source: 'receipts' as const,
        status: draft.status ?? 'active',
        archivedAt: draft.archivedAt ?? null,
      })
    );

    const tempahanData = tempahanResponse.ok ? await tempahanResponse.json() : { drafts: [] };
    const tempahanRowsRaw = (Array.isArray(tempahanData.drafts) ? tempahanData.drafts : []) as TempahanDraftApiRow[];
    const tempahanRows: ResitDraftRow[] = tempahanRowsRaw.map((draft) => ({
      id: draft.receiptDraftId,
      noResit: draft.noResit,
      noSeriSebatHarga: draft.noSeriSebatHarga,
      namaPenerima: draft.namaPenerima,
      namaKolejVokasional: draft.namaKolejVokasional,
      tajuk: draft.tajuk,
      perkara: draft.perkara,
      kuantiti: Number(draft.kuantiti ?? 0),
      hargaSeunit: Number(draft.hargaSeunit ?? 0),
      hargaPostage: Number(draft.hargaPostage ?? 0),
      tarikh: String(draft.tarikh ?? ''),
      semester: String(draft.semester ?? ''),
      createdAt: String(draft.createdAt ?? ''),
      updatedAt: String(draft.updatedAt ?? ''),
      status: draft.status ?? 'active',
      archivedAt: draft.archivedAt ?? null,
      source: 'tempahan' as const,
      tempahanDraftId: draft.id,
    }));

    const merged = new Map<string, ResitDraftRow>();
    for (const draft of receiptRows) {
      merged.set(draft.id, draft);
    }
    for (const draft of tempahanRows) {
      merged.set(draft.id, draft);
    }

    const mergedRows = Array.from(merged.values());
    setDrafts(mergedRows);
    setSelectedIds((prev) => prev.filter((id) => mergedRows.some((row) => row.id === id)));
  };

  const refreshModules = async () => {
    const response = await fetch('/api/penerbitan', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Gagal ambil modul dari Rekod Jualan.');
    }

    const data = await response.json();
    const rows = (Array.isArray(data.penerbitan) ? data.penerbitan : []) as Array<Record<string, unknown>>;

    const nextModules = rows
      .filter((row: Record<string, unknown>) => Number(row.aktif ?? 0) === 1)
      .map((row: Record<string, unknown>): ModuleOption => ({
        id: String(row.id ?? ''),
        perkara: String(row.perkara ?? '').trim(),
        hargaSeunit: Number(row.hargaSeunit ?? 0),
      }))
      .filter((row: ModuleOption) => Boolean(row.id && row.perkara))
      .sort((a: ModuleOption, b: ModuleOption) => a.perkara.localeCompare(b.perkara));

    setModules(nextModules);
  };

  const initialize = async () => {
    setIsLoading(true);
    try {
      await Promise.all([refreshReceipts(), refreshModules()]);
    } catch (error) {
      toast({
        title: 'Muat Data Gagal',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initialize();
  }, [activeTab]);

  const resetForm = () => {
    setNamaPenerima('');
    setNoPhoneCustomer('');
    setAlamatCustomer('');
    setPoskodCustomer('');
    setNamaKolejVokasional('');
    setSelectedModuleId('');
    setPerkara('');
    setHargaSeunit('0');
    setKuantiti('1');
    setHargaPostage('0');
    setJumlahParcel('1');
    setTarikh(new Date().toISOString().slice(0, 10));
  };

  const handleSelectModule = (value: string) => {
    setSelectedModuleId(value);
    const selected = modules.find((module) => module.id === value);
    if (selected) {
      setPerkara(selected.perkara);
      setHargaSeunit(String(selected.hargaSeunit));
    }
  };

  const handleSaveDraft = async () => {
    const qty = Number(kuantiti);
    const unit = Number(hargaSeunit);
    const postage = Number(hargaPostage);
    const bilanganParcel = Number(jumlahParcel);

    if (!namaPenerima.trim() || !namaKolejVokasional.trim() || !perkara.trim()) {
      toast({
        title: 'Maklumat Tidak Lengkap',
        description: 'Sila isi Nama Penerima, Nama Kolej Vokasional, dan Perkara.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedModuleId.trim()) {
      toast({
        title: 'Modul Tidak Dipilih',
        description: 'Sila pilih modul dari dropdown Perkara supaya Rekod Jualan dikemaskini.',
        variant: 'destructive',
      });
      return;
    }

    const noPhone = noPhoneCustomer.trim();
    if (!noPhone) {
      toast({
        title: 'No Phone Customer Tiada',
        description: 'Sila pilih pelanggan dari autosuggest supaya no phone dapat diambil dari data customer.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isInteger(qty) || qty <= 0 || unit < 0 || postage < 0 || !Number.isInteger(bilanganParcel) || bilanganParcel < 1) {
      toast({
        title: 'Nilai Tidak Sah',
        description: 'Kuantiti/Jumlah Parcel mesti integer > 0. Harga mesti tidak negatif.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const receiptResponse = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namaPenerima: namaPenerima.trim(),
          namaKolejVokasional: namaKolejVokasional.trim(),
          perkara: perkara.trim(),
          kuantiti: qty,
          hargaSeunit: unit,
          hargaPostage: postage,
          tarikh,
        }),
      });

      const receiptData = await receiptResponse.json().catch(() => ({}));
      if (!receiptResponse.ok) {
        throw new Error(receiptData.error ?? 'Tidak dapat simpan ke senarai draf.');
      }

      const receiptDraftId = String(receiptData?.receipt?.id ?? '');
      const noResitCreated = String(receiptData?.receipt?.noResit ?? '');
      if (!receiptDraftId) {
        throw new Error('ID draft resit tidak dijumpai selepas simpan.');
      }

      const noOrder = getNoOrderFromNoResit(noResitCreated || noResit);

      const parcelResponse = await fetch('/api/data-parcel/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namaCustomer: namaPenerima.trim(),
          alamat: alamatCustomer.trim(),
          poskod: poskodCustomer.trim(),
          kv: namaKolejVokasional.trim(),
          noPhone,
          noOrder,
          bilanganParcel,
        }),
      });

      const parcelData = await parcelResponse.json().catch(() => ({}));
      if (!parcelResponse.ok) {
        await fetch(`/api/receipts/${receiptDraftId}`, { method: 'DELETE' });
        throw new Error(parcelData.error ?? 'Gagal sync Data Parcel placeholder untuk Tempahan.');
      }

      const parcelDraftId = String(parcelData?.draft?.id ?? parcelData?.dataParcel?.id ?? '');
      if (!parcelDraftId) {
        await fetch(`/api/receipts/${receiptDraftId}`, { method: 'DELETE' });
        throw new Error('ID Data Parcel placeholder tidak dijumpai.');
      }

      const tempahanResponse = await fetch('/api/tempahan/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptDraftId,
          dataParcelDraftId: parcelDraftId,
          bilanganAlamat: 3,
          penerbitanId: selectedModuleId,
        }),
      });

      const tempahanData = await tempahanResponse.json().catch(() => ({}));
      if (!tempahanResponse.ok) {
        await fetch(`/api/data-parcel/drafts/${parcelDraftId}`, { method: 'DELETE' });
        await fetch(`/api/receipts/${receiptDraftId}`, { method: 'DELETE' });
        throw new Error(tempahanData.error ?? 'Gagal sync draft Tempahan.');
      }

      if (tempahanResponse.ok) {
        toast({
          title: 'Disimpan & Sync Tempahan',
          description: 'Draf Resit-1 berjaya disimpan dan diselaraskan ke Tempahan (Bilangan Alamat = 3).',
        });
      }

      await refreshReceipts();
      resetForm();
    } catch (error) {
      toast({
        title: 'Simpan Gagal',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetResit = async () => {
    const startNo = Number(resetResitNumber);
    if (!Number.isInteger(startNo) || startNo < 1) {
      toast({
        title: 'No Mula Tidak Sah',
        description: 'Sila masukkan nombor mula yang valid (>=1).',
        variant: 'destructive',
      });
      return;
    }

    setIsResettingResit(true);
    try {
      const response = await fetch('/api/receipts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startNo, resetType: 'resit' }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? 'Gagal reset No Resit.');
      }

      await refreshReceipts();
      setIsResetResitDialogOpen(false);
      setResetResitNumber('1');
      toast({
        title: 'Reset No Resit Berjaya',
        description: `No Resit bermula dari ${String(startNo).padStart(4, '0')}`,
      });
    } catch (error) {
      toast({
        title: 'Reset Gagal',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsResettingResit(false);
    }
  };

  const handleResetSebatHarga = async () => {
    const startNo = Number(resetSebatHargaNumber);
    if (!Number.isInteger(startNo) || startNo < 1) {
      toast({
        title: 'No Mula Tidak Sah',
        description: 'Sila masukkan nombor mula yang valid (>=1).',
        variant: 'destructive',
      });
      return;
    }

    setIsResettingSebatHarga(true);
    try {
      const response = await fetch('/api/receipts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startNo, resetType: 'sebat_harga' }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? 'Gagal reset No Sebut Harga.');
      }

      await refreshReceipts();
      setIsResetSebatHargaDialogOpen(false);
      setResetSebatHargaNumber('1');
      toast({
        title: 'Reset No Sebut Harga Berjaya',
        description: `No Sebut Harga bermula dari ${String(startNo).padStart(3, '0')}`,
      });
    } catch (error) {
      toast({
        title: 'Reset Gagal',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsResettingSebatHarga(false);
    }
  };

  const handleExportZip = async () => {
    if (activeTab !== 'active') {
      toast({
        title: 'Export Untuk Draf Aktif Sahaja',
        description: 'Tukar ke tab Draft untuk eksport ZIP.',
        variant: 'destructive',
      });
      return;
    }

    const visibleDraftIdSet = new Set(visibleDrafts.map((draft) => draft.id));
    const selectedVisibleIds = selectedIds.filter((id) => visibleDraftIdSet.has(id));

    if (selectedVisibleIds.length === 0) {
      toast({
        title: 'Tiada Pilihan',
        description: 'Tick sekurang-kurangnya satu draf untuk eksport ZIP.',
        variant: 'destructive',
      });
      return;
    }

    setIsExportingZip(true);
    try {
      const params = new URLSearchParams({
        status: 'active',
        source: 'all',
        ids: selectedVisibleIds.join(','),
      });
      const response = await fetch(`/api/receipts/export-pdf?${params.toString()}`, { method: 'GET' });
      const blob = await response.blob();

      if (!response.ok) {
        const text = await blob.text().catch(() => 'Gagal eksport ZIP PDF.');
        throw new Error(text || 'Gagal eksport ZIP PDF.');
      }

      const disposition = response.headers.get('Content-Disposition') ?? '';
      const matchedName = disposition.match(/filename="?([^\";]+)"?/i)?.[1];
      const fileName = matchedName ?? `invoice-pdf-export-${Date.now()}.zip`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({
        title: 'Eksport Berjaya',
        description: `Fail ZIP invoice berjaya dijana untuk ${selectedVisibleIds.length} draf dipilih.`,
      });
    } catch (error) {
      toast({
        title: 'Eksport Gagal',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    setIsDeletingDraftId(id);
    try {
      const row = drafts.find((item) => item.id === id);
      if (row?.source === 'tempahan') {
        throw new Error('Draf dari Tempahan tidak boleh dipadam dari Resit-1. Sila urus di page Tempahan.');
      }

      const response = await fetch(`/api/receipts/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? 'Gagal padam draf resit.');
      }

      await refreshReceipts();
      toast({ title: 'Draf Dipadam', description: 'Draf resit telah dipadam.' });
    } catch (error) {
      toast({
        title: 'Padam Gagal',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsDeletingDraftId(null);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(visibleDrafts.map((draft) => draft.id));
      return;
    }
    setSelectedIds([]);
  };

  const toggleSelectedId = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      return;
    }
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  };

  const handleArchiveSelected = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: 'Tiada Pilihan',
        description: 'Tick sekurang-kurangnya satu draf untuk dipindahkan ke Rekod Lama.',
        variant: 'destructive',
      });
      return;
    }

    setIsArchivingSelected(true);
    try {
      for (const id of selectedIds) {
        const row = drafts.find((item) => item.id === id);
        if (!row) continue;

        const response =
          row.source === 'tempahan' && row.tempahanDraftId
            ? await fetch(`/api/tempahan/drafts/${row.tempahanDraftId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'archive' }),
              })
            : await fetch(`/api/receipts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'archive' }),
              });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error ?? `Gagal archive draf ${row.noResit}`);
        }
      }

      toast({ title: 'Rekod Lama Berjaya', description: `${selectedIds.length} draf dipindah ke Rekod Lama.` });
      setSelectedIds([]);
      await refreshReceipts();
    } catch (error) {
      toast({
        title: 'Rekod Lama Gagal',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsArchivingSelected(false);
    }
  };

  const handleRestoreSelected = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: 'Tiada Pilihan',
        description: 'Tick sekurang-kurangnya satu draf untuk dipulihkan.',
        variant: 'destructive',
      });
      return;
    }

    setIsRestoringSelected(true);
    try {
      for (const id of selectedIds) {
        const row = drafts.find((item) => item.id === id);
        if (!row) continue;

        const response =
          row.source === 'tempahan' && row.tempahanDraftId
            ? await fetch(`/api/tempahan/drafts/${row.tempahanDraftId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'restore' }),
              })
            : await fetch(`/api/receipts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'restore' }),
              });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error ?? `Gagal pulihkan draf ${row.noResit}`);
        }
      }

      toast({ title: 'Pulih Berjaya', description: `${selectedIds.length} draf dipulihkan ke Draft.` });
      setSelectedIds([]);
      await refreshReceipts();
    } catch (error) {
      toast({
        title: 'Pulih Gagal',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsRestoringSelected(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: 'Tiada Pilihan',
        description: 'Tick sekurang-kurangnya satu draf untuk padam.',
        variant: 'destructive',
      });
      return;
    }

    const selectedRows = drafts.filter((item) => selectedIds.includes(item.id));
    const deletable = selectedRows.filter((item) => item.source === 'receipts');
    const blocked = selectedRows.filter((item) => item.source === 'tempahan');

    if (deletable.length === 0) {
      toast({
        title: 'Tidak Boleh Dipadam',
        description: 'Pilihan anda hanya mengandungi draf dari Tempahan.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeletingSelected(true);
    try {
      for (const row of deletable) {
        await handleDeleteDraft(row.id);
      }

      if (blocked.length > 0) {
        toast({
          title: 'Delete Separa',
          description: `${deletable.length} dipadam. ${blocked.length} draf Tempahan tidak dipadam di sini.`,
        });
      } else {
        toast({ title: 'Delete Berjaya', description: `${deletable.length} draf dipadam dari Rekod Lama.` });
      }

      setSelectedIds([]);
      await refreshReceipts();
    } catch (error) {
      toast({
        title: 'Delete Gagal',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsDeletingSelected(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in space-y-6">
      <PageHeader
        title="Jana Resit"
        description="Cipta Custom Resit untuk Customer Tertentu."
      />

      <Card>
        <CardHeader>
          <CardTitle>Borang Resit</CardTitle>
          <CardDescription>
            
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>No Siri Resit</Label>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input value={noResit} disabled className="mb-2" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsResetResitDialogOpen(true)}
                    disabled={isResettingResit}
                    className="w-full"
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Reset No Resit
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>No Siri Sebut Harga</Label>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input value={noSeriSebatHarga} disabled className="mb-2" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsResetSebatHargaDialogOpen(true)}
                    disabled={isResettingSebatHarga}
                    className="w-full"
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Reset No Sebut Harga
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Dialog open={isResetResitDialogOpen} onOpenChange={setIsResetResitDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset No Siri Resit</DialogTitle>
                <DialogDescription>
                  Masukkan nombor mula untuk No Siri Resit (akan diformat ke 4 digit).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-resit-number">Nombor Mula</Label>
                  <Input
                    id="reset-resit-number"
                    type="number"
                    min="1"
                    value={resetResitNumber}
                    onChange={(e) => setResetResitNumber(e.target.value)}
                    placeholder="Contoh: 1 atau 2001"
                  />
                  <p className="text-xs text-muted-foreground">
                    Contoh: 1 → 0001, 2001 → 2001
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsResetResitDialogOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={handleResetResit}
                  disabled={isResettingResit}
                >
                  {isResettingResit ? 'Melakukan Reset...' : 'Reset'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isResetSebatHargaDialogOpen} onOpenChange={setIsResetSebatHargaDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset No Siri Sebut Harga</DialogTitle>
                <DialogDescription>
                  Masukkan nombor mula untuk No Siri Sebut Harga (akan diformat ke 3 digit).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-sebat-harga-number">Nombor Mula</Label>
                  <Input
                    id="reset-sebat-harga-number"
                    type="number"
                    min="1"
                    value={resetSebatHargaNumber}
                    onChange={(e) => setResetSebatHargaNumber(e.target.value)}
                    placeholder="Contoh: 1 atau 201"
                  />
                  <p className="text-xs text-muted-foreground">
                    Contoh: 1 → 001, 201 → 201
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsResetSebatHargaDialogOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={handleResetSebatHarga}
                  disabled={isResettingSebatHarga}
                >
                  {isResettingSebatHarga ? 'Melakukan Reset...' : 'Reset'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nama Penerima</Label>
              <CustomerAutocomplete
                value={namaPenerima}
                onValueChange={(value) => {
                  setNamaPenerima(value);
                  setNoPhoneCustomer('');
                  setAlamatCustomer('');
                  setPoskodCustomer('');
                }}
                onCustomerSelect={(customer: CustomerLite) => {
                  setNamaPenerima(customer.name);
                  setNoPhoneCustomer(String(customer.phone ?? '').trim());
                  setAlamatCustomer(String(customer.address ?? '').trim());
                  setPoskodCustomer(String(customer.postcode ?? '').trim());
                  if (!namaKolejVokasional.trim()) {
                    setNamaKolejVokasional(customer.kodKV ?? '');
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Nama Kolej Vokasional</Label>
              <KVAutocomplete
                value={namaKolejVokasional}
                onValueChange={setNamaKolejVokasional}
                onKVSelect={(kv) => setNamaKolejVokasional(kv.kodKV)}
                placeholder="Cari atau taip nama/kod KV"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pilih Modul</Label>
              <Select value={selectedModuleId} onValueChange={handleSelectModule}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoading ? 'Memuat modul...' : 'Pilih modul perkara'} />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.perkara}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Harga Seunit</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={hargaSeunit}
                onChange={(e) => setHargaSeunit(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Kuantiti</Label>
              <Input
                type="number"
                min={1}
                step="1"
                value={kuantiti}
                onChange={(e) => setKuantiti(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Harga Penghantaran</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={hargaPostage}
                onChange={(e) => setHargaPostage(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Jumlah Parcel</Label>
              <Input
                type="number"
                min={1}
                step="1"
                value={jumlahParcel}
                onChange={(e) => setJumlahParcel(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tarikh</Label>
              <Input type="date" value={tarikh} onChange={(e) => setTarikh(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Jumlah Harga</Label>
              <Input value={toMoney(jumlahHarga)} disabled />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSaveDraft} disabled={isSaving} className="w-full sm:w-auto">
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Menyimpan...' : 'Simpan ke Senarai'}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} className="w-full sm:w-auto">
              Reset Borang
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Senarai Draf Resit</CardTitle>
          <CardDescription>
            
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <Button
                type="button"
                variant={activeTab === 'active' ? 'default' : 'outline'}
                onClick={() => {
                  setActiveTab('active');
                  setSearchRekodLama('');
                  setSelectedIds([]);
                }}
                className="w-full sm:w-auto"
              >
                Draft
              </Button>
              <Button
                type="button"
                variant={activeTab === 'archived' ? 'default' : 'outline'}
                onClick={() => {
                  setActiveTab('archived');
                  setSelectedIds([]);
                }}
                className="w-full sm:w-auto"
              >
                Rekod Lama
              </Button>
            </div>

            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
              {activeTab === 'active' ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleArchiveSelected}
                    disabled={isArchivingSelected || selectedIds.length === 0}
                    className="w-full justify-start sm:w-auto sm:justify-center"
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    {isArchivingSelected ? 'Memindah...' : 'Pindah ke Rekod Lama'}
                  </Button>
                  <Button type="button" onClick={handleExportZip} disabled={isExportingZip || selectedIds.length === 0} className="w-full justify-start sm:w-auto sm:justify-center">
                    <Download className="mr-2 h-4 w-4" />
                    {isExportingZip ? 'Mengeksport...' : `Eksport Invois (${selectedIds.length})`}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRestoreSelected}
                    disabled={isRestoringSelected || selectedIds.length === 0}
                    className="w-full justify-start sm:w-auto sm:justify-center"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {isRestoringSelected ? 'Memulih...' : 'Pulihkan Pilihan'}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteSelected}
                    disabled={isDeletingSelected || selectedIds.length === 0}
                    className="w-full justify-start sm:w-auto sm:justify-center"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isDeletingSelected ? 'Memadam...' : 'Padam Pilihan'}
                  </Button>
                </>
              )}
            </div>
          </div>

          {activeTab === 'archived' && (
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="search-rekod-lama" className="whitespace-nowrap text-sm">
                Cari KV:
              </Label>
              <Input
                id="search-rekod-lama"
                type="text"
                placeholder="Taip nama/kod KV..."
                value={searchRekodLama}
                onChange={(e) => setSearchRekodLama(e.target.value)}
                className="w-full sm:max-w-sm"
              />
              {searchRekodLama && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSearchRekodLama('')}>
                  Reset
                </Button>
              )}
              <span className="text-sm text-muted-foreground sm:ml-auto">{visibleDrafts.length} rekod dijumpai</span>
            </div>
          )}

          <div className="flex justify-end">
            <span className="text-sm text-muted-foreground">Dipilih: {selectedIds.length}</span>
          </div>

          <div className="border rounded-md overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44px]">
                    <Checkbox
                      checked={visibleDrafts.length > 0 && selectedIds.length === visibleDrafts.length}
                      onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                      aria-label="Pilih semua"
                    />
                  </TableHead>
                  <TableHead>No Resit</TableHead>
                  <TableHead>Sumber</TableHead>
                  <TableHead>Nama Penerima</TableHead>
                  <TableHead>KV</TableHead>
                  <TableHead>Perkara</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleDrafts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {activeTab === 'active'
                        ? 'Tiada draf lagi. Simpan borang di atas untuk mula bina senarai.'
                        : 'Tiada rekod lama.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleDrafts.map((draft) => {
                    const total = draft.kuantiti * draft.hargaSeunit + draft.hargaPostage;
                    return (
                      <TableRow key={draft.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(draft.id)}
                            onCheckedChange={(checked) => toggleSelectedId(draft.id, Boolean(checked))}
                            aria-label={`Pilih ${draft.noResit}`}
                          />
                        </TableCell>
                        <TableCell>{draft.noResit}</TableCell>
                        <TableCell>{draft.source === 'tempahan' ? 'Tempahan' : 'Resit-1'}</TableCell>
                        <TableCell>{draft.namaPenerima}</TableCell>
                        <TableCell>{draft.namaKolejVokasional}</TableCell>
                        <TableCell className="max-w-[380px] truncate" title={draft.perkara}>{draft.perkara}</TableCell>
                        <TableCell className="text-right">{toMoney(total)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}