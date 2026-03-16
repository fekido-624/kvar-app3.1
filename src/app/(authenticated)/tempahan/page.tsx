"use client";

import { useEffect, useMemo, useState } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Archive, Download, FileArchive, Printer, RotateCcw, Save, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CustomerAutocomplete } from '@/components/customer-autocomplete';
import { KVAutocomplete } from '@/components/kv-autocomplete';
import { useToast } from '@/hooks/use-toast';
import { ReceiptPerkaraOption, ReceiptTajukOption } from '@/lib/types';
import { buildSebutHargaTitle } from '@/lib/module-text';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type TempahanDraft = {
  id: string;
  noResit: string;
  namaPenerima: string;
  namaKolejVokasional: string;
  perkara: string;
  kuantiti: number;
  hargaSeunit: number;
  hargaPostage: number;
  bilanganAlamat: number;
  bilanganParcel: number;
  noOrder: string;
  alamat: string;
  poskod: string;
  noPhone: string;
  status: 'active' | 'archived';
  archivedAt: string;
  createdAt: string;
};

type PenerbitanOption = {
  id: string;
  perkara: string;
  tajuk: string;
  semester: number;
  tahun: number;
  edisi: number;
  hargaSeunit: number;
  aktif: number;
};

const emptyForm = {
  penerbitanId: '',
  namaPenerima: '',
  namaKolejVokasional: '',
  tajuk: '',
  perkara: '',
  kuantiti: '1',
  hargaSeunit: '0',
  hargaPostage: '0',
  tarikh: new Date().toISOString().slice(0, 10),
  semester: '',
  alamat: '',
  poskod: '',
  noPhone: '',
  bilanganAlamat: '1',
  bilanganParcel: '1',
};

const toCurrency = (value: number) => `RM ${value.toFixed(2)}`;

const parseNumber = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getNoOrderFromNoResit = (noResit: string) => {
  const numeric = Number.parseInt(noResit.replace(/\D/g, ''), 10);
  if (Number.isNaN(numeric)) {
    return noResit.slice(-2).padStart(2, '0');
  }

  const value = numeric % 1000;
  const padLength = value >= 100 ? 3 : 2;
  return String(value).padStart(padLength, '0');
};

const resolveNoOrder = (item: { noOrder: string; noResit: string }) => {
  return item.noOrder?.trim() || getNoOrderFromNoResit(item.noResit);
};

const normalizeDraft = (item: Record<string, unknown>): TempahanDraft => ({
  id: String(item.id ?? ''),
  noResit: String(item.noResit ?? ''),
  namaPenerima: String(item.namaPenerima ?? ''),
  namaKolejVokasional: String(item.namaKolejVokasional ?? ''),
  perkara: String(item.perkara ?? ''),
  kuantiti: Number(item.kuantiti ?? 0),
  hargaSeunit: Number(item.hargaSeunit ?? 0),
  hargaPostage: Number(item.hargaPostage ?? 0),
  bilanganAlamat: Number(item.bilanganAlamat ?? 1),
  bilanganParcel: Number(item.bilanganParcel ?? 1),
  noOrder: String(item.noOrder ?? ''),
  alamat: String(item.alamat ?? ''),
  poskod: String(item.poskod ?? ''),
  noPhone: String(item.noPhone ?? ''),
  status: item.status === 'archived' ? 'archived' : 'active',
  archivedAt: String(item.archivedAt ?? ''),
  createdAt: String(item.createdAt ?? ''),
});

export default function TempahanPage() {
  const [form, setForm] = useState(emptyForm);
  const [lastHargaSeunit, setLastHargaSeunit] = useState(emptyForm.hargaSeunit);
  const [draftStatusView, setDraftStatusView] = useState<'active' | 'archived'>('active');
  const [drafts, setDrafts] = useState<TempahanDraft[]>([]);
  const [perkaraOptions, setPerkaraOptions] = useState<ReceiptPerkaraOption[]>([]);
  const [newPerkaraOption, setNewPerkaraOption] = useState('');
  const [selectedPerkaraOptionId, setSelectedPerkaraOptionId] = useState('');
  const [tajukOptions, setTajukOptions] = useState<ReceiptTajukOption[]>([]);
  const [penerbitanOptions, setPenerbitanOptions] = useState<PenerbitanOption[]>([]);
  const [newTajukOption, setNewTajukOption] = useState('');
  const [selectedTajukOptionId, setSelectedTajukOptionId] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPerkaraOption, setIsSavingPerkaraOption] = useState(false);
  const [isSavingTajukOption, setIsSavingTajukOption] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isArchivingAll, setIsArchivingAll] = useState(false);
  const [isRestoringSelected, setIsRestoringSelected] = useState(false);
  const [isArchivingSelected, setIsArchivingSelected] = useState(false);
  const [isDeletingSelectedArchived, setIsDeletingSelectedArchived] = useState(false);
  const [selectedActiveIds, setSelectedActiveIds] = useState<string[]>([]);
  const [selectedArchivedIds, setSelectedArchivedIds] = useState<string[]>([]);
  const [archiveDateFrom, setArchiveDateFrom] = useState('');
  const [archiveDateTo, setArchiveDateTo] = useState('');
  const { toast } = useToast();

  const jumlah = useMemo(() => {
    const qty = parseNumber(form.kuantiti, 0);
    const unit = parseNumber(form.hargaSeunit, 0);
    const postage = parseNumber(form.hargaPostage, 0);
    return qty * unit + postage;
  }, [form.kuantiti, form.hargaSeunit, form.hargaPostage]);

  const filteredDrafts = useMemo(() => {
    if (draftStatusView !== 'archived') {
      return drafts;
    }

    const fromDate = archiveDateFrom ? new Date(`${archiveDateFrom}T00:00:00`) : null;
    const toDate = archiveDateTo ? new Date(`${archiveDateTo}T23:59:59.999`) : null;

    return drafts.filter((item) => {
      const rawDate = item.archivedAt || item.createdAt;
      const itemDate = new Date(rawDate);
      if (Number.isNaN(itemDate.getTime())) {
        return false;
      }

      if (fromDate && itemDate < fromDate) {
        return false;
      }

      if (toDate && itemDate > toDate) {
        return false;
      }

      return true;
    });
  }, [archiveDateFrom, archiveDateTo, draftStatusView, drafts]);

  const loadDrafts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tempahan/drafts?status=${draftStatusView}`, { cache: 'no-store' });
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const rows = Array.isArray(data.drafts) ? data.drafts : [];
      setDrafts(rows.map((item: unknown) => normalizeDraft(item as Record<string, unknown>)));
    } finally {
      setIsLoading(false);
    }
  };

  const loadPerkaraOptions = async () => {
    const response = await fetch('/api/receipt-perkara', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setPerkaraOptions(data.options ?? []);
  };

  const loadTajukOptions = async () => {
    const response = await fetch('/api/receipt-tajuk', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setTajukOptions(data.options ?? []);
  };

  const loadPenerbitanOptions = async () => {
    const response = await fetch('/api/penerbitan', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    const rows = (Array.isArray(data.penerbitan) ? data.penerbitan : []).map(
      (row: Record<string, unknown>) => ({
        ...row,
        aktif: Number(row.aktif ?? 0),
        semester: Number(row.semester ?? 0),
        tahun: Number(row.tahun ?? 0),
        hargaSeunit: Number(row.hargaSeunit ?? 0),
      })
    );
    setPenerbitanOptions(rows as PenerbitanOption[]);
  };

  useEffect(() => {
    void loadDrafts();
    void loadPerkaraOptions();
    void loadTajukOptions();
    void loadPenerbitanOptions();
  }, [draftStatusView]);

  useEffect(() => {
    setSelectedActiveIds([]);
    setSelectedArchivedIds([]);
    if (draftStatusView !== 'archived') {
      setArchiveDateFrom('');
      setArchiveDateTo('');
    }
  }, [draftStatusView]);

  const updateForm = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSelectCustomer = (customer: {
    id: string;
    name: string;
    kodKV: string;
    address?: string;
    postcode?: string;
    phone?: string;
  }) => {
    setForm((current) => ({
      ...current,
      namaPenerima: customer.name,
      namaKolejVokasional: customer.kodKV,
      alamat: customer.address ?? current.alamat,
      poskod: customer.postcode ?? current.poskod,
      noPhone: customer.phone ?? current.noPhone,
    }));
  };

  const handleSelectKV = (item: {
    id: string;
    name: string;
    address: string;
    postcode: string;
    phone: string;
    kodKV: string;
  }) => {
    setForm((current) => ({
      ...current,
      namaPenerima: item.name,
      namaKolejVokasional: item.kodKV,
      alamat: item.address,
      poskod: item.postcode,
      noPhone: item.phone,
    }));
  };

  const handleSaveTempahan = async () => {
    if (isSaving) return;

    const kuantiti = parseNumber(form.kuantiti, 0);
    const hargaSeunit = parseNumber(form.hargaSeunit, 0);
    const hargaPostage = parseNumber(form.hargaPostage, 0);
    const bilanganAlamat = parseNumber(form.bilanganAlamat, 0);
    const bilanganParcel = parseNumber(form.bilanganParcel, 0);

    const requiredPairs: Array<[string, string]> = [
      ['Modul (Penerbitan)', form.penerbitanId],
      ['Nama Penerima', form.namaPenerima],
      ['Nama Kolej Vokasional', form.namaKolejVokasional],
      ['Tarikh', form.tarikh],
      ['Alamat', form.alamat],
      ['Poskod', form.poskod],
      ['No Phone', form.noPhone],
    ];

    const missing = requiredPairs.filter(([, value]) => !value.trim()).map(([label]) => label);
    if (missing.length > 0) {
      toast({
        title: 'Form belum lengkap',
        description: `Sila lengkapkan: ${missing.join(', ')}.`,
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isInteger(kuantiti) || kuantiti < 1 || hargaSeunit < 0 || hargaPostage < 0) {
      toast({
        title: 'Nilai resit tidak sah',
        description: 'Semak kuantiti, harga seunit dan harga postage.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isInteger(bilanganAlamat) || bilanganAlamat < 1 || !Number.isInteger(bilanganParcel) || bilanganParcel < 1) {
      toast({
        title: 'Bilangan tidak sah',
        description: 'Bilangan alamat dan jumlah parcel mesti 1 atau lebih.',
        variant: 'destructive',
      });
      return;
    }

    setLastHargaSeunit(form.hargaSeunit);
    setIsSaving(true);
    try {
      const receiptResponse = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namaPenerima: form.namaPenerima.trim(),
          namaKolejVokasional: form.namaKolejVokasional.trim(),
          tajuk: form.tajuk.trim(),
          perkara: form.perkara.trim(),
          kuantiti,
          hargaSeunit,
          hargaPostage,
          tarikh: form.tarikh,
          semester: form.semester.trim(),
        }),
      });

      if (!receiptResponse.ok) {
        const data = await receiptResponse.json().catch(() => ({}));
        toast({
          title: 'Simpan Tempahan Gagal',
          description: data.error ?? 'Tidak dapat simpan draf resit untuk tempahan.',
          variant: 'destructive',
        });
        return;
      }

      const receiptJson = await receiptResponse.json().catch(() => ({}));
      const receiptDraftId = String(receiptJson?.receipt?.id ?? '');
      const noResit = String(receiptJson?.receipt?.noResit ?? '');
      const noOrder = getNoOrderFromNoResit(noResit);

      if (!receiptDraftId) {
        toast({
          title: 'Simpan Tempahan Gagal',
          description: 'ID draf resit tidak dijumpai selepas simpan.',
          variant: 'destructive',
        });
        return;
      }

      const parcelResponse = await fetch('/api/data-parcel/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namaCustomer: form.namaPenerima.trim(),
          alamat: form.alamat.trim(),
          poskod: form.poskod.trim(),
          kv: form.namaKolejVokasional.trim(),
          noPhone: form.noPhone.trim(),
          noOrder,
          bilanganParcel,
        }),
      });

      if (!parcelResponse.ok) {
        await fetch(`/api/receipts/${receiptDraftId}`, { method: 'DELETE' });
        const data = await parcelResponse.json().catch(() => ({}));
        toast({
          title: 'Simpan Tempahan Gagal',
          description: data.error ?? 'Tidak dapat simpan draf parcel untuk tempahan.',
          variant: 'destructive',
        });
        return;
      }

      const parcelJson = await parcelResponse.json().catch(() => ({}));
      const parcelDraftId = String(parcelJson?.draft?.id ?? '');
      if (!parcelDraftId) {
        await fetch(`/api/receipts/${receiptDraftId}`, { method: 'DELETE' });
        toast({
          title: 'Simpan Tempahan Gagal',
          description: 'ID draf parcel tidak dijumpai selepas simpan.',
          variant: 'destructive',
        });
        return;
      }

      const tempahanResponse = await fetch('/api/tempahan/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptDraftId,
          dataParcelDraftId: parcelDraftId,
          bilanganAlamat,
          penerbitanId: form.penerbitanId || undefined,
        }),
      });

      if (!tempahanResponse.ok) {
        await fetch(`/api/receipts/${receiptDraftId}`, { method: 'DELETE' });
        await fetch(`/api/data-parcel/drafts/${parcelDraftId}`, { method: 'DELETE' });

        const data = await tempahanResponse.json().catch(() => ({}));
        toast({
          title: 'Simpan Tempahan Gagal',
          description: data.error ?? 'Tidak dapat simpan draf tempahan.',
          variant: 'destructive',
        });
        return;
      }

      await loadDrafts();
      setForm((current) => ({
        ...emptyForm,
        tajuk: current.tajuk,
        perkara: current.perkara,
        penerbitanId: current.penerbitanId,
        hargaSeunit: lastHargaSeunit,
      }));
      toast({
        title: 'Tempahan Disimpan',
        description: `Draf tempahan berjaya disimpan. No Siri: ${noResit}`,
      });
    } catch {
      toast({
        title: 'Simpan Tempahan Gagal',
        description: 'Ralat rangkaian/pelayan semasa simpan tempahan.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePerkaraOption = async () => {
    const label = newPerkaraOption.trim();
    if (!label) return;

    setIsSavingPerkaraOption(true);
    try {
      const response = await fetch('/api/receipt-perkara', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 409 && data.option?.id && data.option?.label) {
          updateForm('perkara', data.option.label);
          setSelectedPerkaraOptionId(data.option.id);
          setNewPerkaraOption('');
          await loadPerkaraOptions();
          toast({
            title: 'Perkara Sudah Ada',
            description: 'Perkara sedia ada dipilih dari menu.',
          });
          return;
        }

        toast({
          title: 'Simpan Perkara Gagal',
          description: data.error ?? `Tidak dapat simpan pilihan perkara (HTTP ${response.status}).`,
          variant: 'destructive',
        });
        return;
      }

      const created = await response.json().catch(() => null);
      setNewPerkaraOption('');
      if (created?.option?.label && created?.option?.id) {
        updateForm('perkara', created.option.label);
        setSelectedPerkaraOptionId(created.option.id);
      }

      await loadPerkaraOptions();
      toast({
        title: 'Perkara Disimpan',
        description: 'Perkara telah ditambah ke menu dropdown.',
      });
    } catch {
      toast({
        title: 'Simpan Perkara Gagal',
        description: 'Ralat rangkaian/pelayan semasa simpan pilihan perkara.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPerkaraOption(false);
    }
  };

  const handleDeletePerkaraOption = async () => {
    if (!selectedPerkaraOptionId) return;

    const response = await fetch(`/api/receipt-perkara/${selectedPerkaraOptionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      toast({
        title: 'Padam Perkara Gagal',
        description: 'Tidak dapat padam pilihan perkara yang dipilih.',
        variant: 'destructive',
      });
      return;
    }

    const deletedOption = perkaraOptions.find((opt) => opt.id === selectedPerkaraOptionId);
    if (deletedOption && form.perkara === deletedOption.label) {
      updateForm('perkara', '');
    }

    setSelectedPerkaraOptionId('');
    await loadPerkaraOptions();
    toast({
      title: 'Perkara Dipadam',
      description: 'Pilihan perkara berjaya dipadam dari menu.',
    });
  };

  const handleSaveTajukOption = async () => {
    const label = newTajukOption.trim();
    if (!label) return;

    setIsSavingTajukOption(true);
    try {
      const response = await fetch('/api/receipt-tajuk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 409 && data.option?.id && data.option?.label) {
          updateForm('tajuk', data.option.label);
          setSelectedTajukOptionId(data.option.id);
          setNewTajukOption('');
          await loadTajukOptions();
          toast({
            title: 'Tajuk Sudah Ada',
            description: 'Tajuk sedia ada dipilih dari menu.',
          });
          return;
        }

        toast({
          title: 'Simpan Tajuk Gagal',
          description: data.error ?? `Tidak dapat simpan pilihan tajuk (HTTP ${response.status}).`,
          variant: 'destructive',
        });
        return;
      }

      const created = await response.json().catch(() => null);
      setNewTajukOption('');
      if (created?.option?.label && created?.option?.id) {
        updateForm('tajuk', created.option.label);
        setSelectedTajukOptionId(created.option.id);
      }

      await loadTajukOptions();
      toast({
        title: 'Tajuk Disimpan',
        description: 'Tajuk telah ditambah ke menu dropdown.',
      });
    } catch {
      toast({
        title: 'Simpan Tajuk Gagal',
        description: 'Ralat rangkaian/pelayan semasa simpan pilihan tajuk.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingTajukOption(false);
    }
  };

  const handleDeleteTajukOption = async () => {
    if (!selectedTajukOptionId) return;

    const response = await fetch(`/api/receipt-tajuk/${selectedTajukOptionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      toast({
        title: 'Padam Tajuk Gagal',
        description: 'Tidak dapat padam pilihan tajuk yang dipilih.',
        variant: 'destructive',
      });
      return;
    }

    const deletedOption = tajukOptions.find((opt) => opt.id === selectedTajukOptionId);
    if (deletedOption && form.tajuk === deletedOption.label) {
      updateForm('tajuk', '');
    }

    setSelectedTajukOptionId('');
    await loadTajukOptions();
    toast({
      title: 'Tajuk Dipadam',
      description: 'Pilihan tajuk berjaya dipadam dari menu.',
    });
  };

  const handleUpdateDraftStatus = async (draftId: string, action: 'archive' | 'restore') => {
    if (isDeletingId) return;
    setIsDeletingId(draftId);

    try {
      const response = await fetch(`/api/tempahan/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        toast({
          title: 'Kemaskini Gagal',
          description: 'Tidak dapat kemaskini status draf tempahan.',
          variant: 'destructive',
        });
        return;
      }

      await loadDrafts();
      toast({
        title: action === 'archive' ? 'Tempahan Diarkibkan' : 'Tempahan Dipulihkan',
        description:
          action === 'archive'
            ? 'Draf tempahan dipindahkan ke arkib.'
            : 'Draf tempahan dipulihkan ke senarai aktif.',
      });
    } catch {
      toast({
        title: 'Kemaskini Gagal',
        description: 'Ralat rangkaian semasa kemaskini status draf tempahan.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (isDeletingId) return;

    const confirmed = window.confirm(
      'Padam draf tempahan ini? Data resit dan data parcel yang berkaitan juga akan dipadam.'
    );
    if (!confirmed) return;

    setIsDeletingId(draftId);
    try {
      const response = await fetch(`/api/tempahan/drafts/${draftId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast({
          title: 'Padam Draf Gagal',
          description: (data as { error?: string }).error ?? 'Tidak dapat padam draf tempahan.',
          variant: 'destructive',
        });
        return;
      }

      await loadDrafts();
      toast({
        title: 'Draf Dipadam',
        description: 'Draf tempahan berjaya dipadam.',
      });
    } catch {
      toast({
        title: 'Padam Draf Gagal',
        description: 'Ralat rangkaian semasa memadam draf tempahan.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleArchiveOrRestoreAll = async () => {
    if (isArchivingAll || filteredDrafts.length === 0) return;

    const action = draftStatusView === 'active' ? 'archive_all' : 'restore_all';
    const confirmed = window.confirm(
      draftStatusView === 'active'
        ? 'Arkibkan semua draf tempahan aktif?' : 'Pulihkan semua draf tempahan arkib?'
    );
    if (!confirmed) return;

    setIsArchivingAll(true);
    try {
      const response = await fetch('/api/tempahan/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        toast({
          title: 'Kemaskini Gagal',
          description: 'Tidak dapat kemaskini semua draf tempahan.',
          variant: 'destructive',
        });
        return;
      }

      await loadDrafts();
      setSelectedActiveIds([]);
      setSelectedArchivedIds([]);
      toast({
        title: draftStatusView === 'active' ? 'Semua Draf Diarkibkan' : 'Semua Draf Dipulihkan',
        description:
          draftStatusView === 'active'
            ? 'Semua draf tempahan aktif telah diarkibkan.'
            : 'Semua draf tempahan arkib telah dipulihkan.',
      });
    } catch {
      toast({
        title: 'Kemaskini Gagal',
        description: 'Ralat rangkaian semasa kemaskini semua draf tempahan.',
        variant: 'destructive',
      });
    } finally {
      setIsArchivingAll(false);
    }
  };

  const handleToggleArchivedSelection = (draftId: string) => {
    setSelectedArchivedIds((current) =>
      current.includes(draftId) ? current.filter((id) => id !== draftId) : [...current, draftId]
    );
  };

  const handleToggleActiveSelection = (draftId: string) => {
    setSelectedActiveIds((current) =>
      current.includes(draftId) ? current.filter((id) => id !== draftId) : [...current, draftId]
    );
  };

  const handleToggleSelectAllActive = (checked: boolean) => {
    if (!checked) {
      setSelectedActiveIds([]);
      return;
    }

    setSelectedActiveIds(filteredDrafts.map((item) => item.id));
  };

  const handleToggleSelectAllArchived = (checked: boolean) => {
    if (!checked) {
      setSelectedArchivedIds([]);
      return;
    }

    setSelectedArchivedIds(filteredDrafts.map((item) => item.id));
  };

  const handleRestoreSelectedArchived = async () => {
    if (selectedArchivedIds.length === 0 || isRestoringSelected) return;

    setIsRestoringSelected(true);
    try {
      const results = await Promise.all(
        selectedArchivedIds.map(async (id) => {
          const response = await fetch(`/api/tempahan/drafts/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'restore' }),
          });
          return { id, ok: response.ok };
        })
      );

      const failedCount = results.filter((item) => !item.ok).length;
      await loadDrafts();
      setSelectedArchivedIds([]);

      if (failedCount > 0) {
        toast({
          title: 'Pulih Sebahagian',
          description: `${results.length - failedCount} berjaya, ${failedCount} gagal dipulihkan.`,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Draf Dipulihkan',
        description: `${results.length} draf arkib berjaya dipulihkan.`,
      });
    } catch {
      toast({
        title: 'Pulih Draf Gagal',
        description: 'Ralat rangkaian semasa memulihkan draf dipilih.',
        variant: 'destructive',
      });
    } finally {
      setIsRestoringSelected(false);
    }
  };

  const handleArchiveSelectedActive = async () => {
    if (selectedActiveIds.length === 0 || isArchivingSelected) return;

    const confirmed = window.confirm(`Arkibkan ${selectedActiveIds.length} draf tempahan dipilih?`);
    if (!confirmed) return;

    setIsArchivingSelected(true);
    try {
      const results = await Promise.all(
        selectedActiveIds.map(async (id) => {
          const response = await fetch(`/api/tempahan/drafts/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'archive' }),
          });
          return { id, ok: response.ok };
        })
      );

      const failedCount = results.filter((item) => !item.ok).length;
      await loadDrafts();
      setSelectedActiveIds([]);

      if (failedCount > 0) {
        toast({
          title: 'Arkib Sebahagian',
          description: `${results.length - failedCount} berjaya, ${failedCount} gagal diarkibkan.`,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Draf Diarkibkan',
        description: `${results.length} draf semasa berjaya diarkibkan.`,
      });
    } catch {
      toast({
        title: 'Arkib Draf Gagal',
        description: 'Ralat rangkaian semasa mengarkib draf dipilih.',
        variant: 'destructive',
      });
    } finally {
      setIsArchivingSelected(false);
    }
  };

  const handleDeleteSelectedArchived = async () => {
    if (selectedArchivedIds.length === 0 || isDeletingSelectedArchived) return;

    const confirmed = window.confirm(
      `Padam ${selectedArchivedIds.length} draf sejarah dipilih? Data resit dan data parcel berkaitan juga akan dipadam.`
    );
    if (!confirmed) return;

    setIsDeletingSelectedArchived(true);
    try {
      const results = await Promise.all(
        selectedArchivedIds.map(async (id) => {
          const response = await fetch(`/api/tempahan/drafts/${id}`, {
            method: 'DELETE',
          });
          return { id, ok: response.ok };
        })
      );

      const failedCount = results.filter((item) => !item.ok).length;
      await loadDrafts();
      setSelectedArchivedIds([]);

      if (failedCount > 0) {
        toast({
          title: 'Delete Sebahagian',
          description: `${results.length - failedCount} berjaya, ${failedCount} gagal dipadam.`,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Delete Berjaya',
        description: `${results.length} draf sejarah berjaya dipadam.`,
      });
    } catch {
      toast({
        title: 'Delete Draf Gagal',
        description: 'Ralat rangkaian semasa memadam draf sejarah dipilih.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingSelectedArchived(false);
    }
  };

  const handleGenerateInvoiceZip = async () => {
    if (drafts.length === 0 || isGenerating) return;

    setIsGenerating(true);
    try {
      const response = await fetch(`/api/receipts/export-pdf?status=${draftStatusView}&source=tempahan`, { method: 'GET' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast({
          title: 'Jana Invois Gagal',
          description: data.error ?? 'Tidak dapat jana PDF invois.',
          variant: 'destructive',
        });
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-pdf-export-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast({
        title: 'Invois Dijana',
        description: 'ZIP PDF invois berjaya dimuat turun.',
      });
    } catch {
      toast({
        title: 'Jana Invois Gagal',
        description: 'Ralat rangkaian semasa jana PDF invois.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateParcelXlsx = async () => {
    if (drafts.length === 0 || isGenerating) return;

    const parcelEligibleDrafts = drafts.filter((item) => item.hargaPostage > 0);
    if (parcelEligibleDrafts.length === 0) {
      toast({
        title: 'Tiada Data Parcel',
        description: 'Semua draf mempunyai harga postage 0, jadi tiada data untuk eksport parcel.',
        variant: 'destructive',
      });
      return;
    }

    const missingPhone = parcelEligibleDrafts.find((item) => !item.noPhone.trim());
    if (missingPhone) {
      toast({
        title: 'No Phone Diperlukan',
        description: 'Ada draf tempahan yang tiada no phone untuk eksport parcel.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const payload = {
        entries: parcelEligibleDrafts.map((item) => ({
          namaCustomer: item.namaPenerima,
          alamat: item.alamat,
          poskod: item.poskod,
          noPhone: item.noPhone,
          noOrder: resolveNoOrder(item),
          bilanganParcel: item.bilanganParcel,
        })),
      };

      const response = await fetch('/api/data-parcel/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast({
          title: 'Jana XLSX Gagal',
          description: data.error ?? 'Tidak dapat jana fail XLSX data parcel.',
          variant: 'destructive',
        });
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `data-parcel-export-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast({
        title: 'XLSX Dijana',
        description: 'Fail data parcel berjaya dimuat turun.',
      });
    } catch {
      toast({
        title: 'Jana XLSX Gagal',
        description: 'Ralat rangkaian semasa jana fail data parcel.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAddressPdf = async () => {
    if (drafts.length === 0 || isGenerating) return;

    const mmToPt = (mm: number) => (mm * 72) / 25.4;
    const pageWidth = mmToPt(105);
    const pageHeight = mmToPt(148);
    const bilColWidth = mmToPt(14);

    const normalizeLine = (line: string) => line.trim().replace(/^,+\s*/, '');

    const wrapText = (
      text: string,
      fontSize: number,
      maxWidth: number,
      font: Awaited<ReturnType<PDFDocument['embedFont']>>
    ): string[] => {
      const words = text.split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const next = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(next, fontSize);

        if (currentLine && width > maxWidth) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = next;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines.length > 0 ? lines : [text];
    };

    setIsGenerating(true);
    try {
      const rows = drafts.flatMap((item) => {
        const copies = Math.max(1, Number(item.bilanganAlamat || 1));
        const alamatLines = [
          ...item.alamat
            .split(/\r?\n/)
            .map((line) => normalizeLine(line))
            .filter(Boolean),
          normalizeLine(item.poskod),
          normalizeLine(item.noPhone),
        ].filter(Boolean);

        return Array.from({ length: copies }, (_, idx) => ({
          id: `${item.id}-${idx}`,
          bil: resolveNoOrder(item),
          nama: item.namaPenerima,
          alamatLines,
        }));
      });

      if (rows.length === 0) {
        toast({
          title: 'Tiada Data Alamat',
          description: 'Draf tempahan tiada data untuk jana PDF alamat.',
          variant: 'destructive',
        });
        return;
      }

      const pdfDoc = await PDFDocument.create();
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const black = rgb(0, 0, 0);

      const chunkSize = 3;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const pageRows = rows.slice(i, i + chunkSize);
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        const fixedRowsPerPage = 3;
        const rowHeight = pageHeight / fixedRowsPerPage;

        page.drawRectangle({
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
          borderColor: black,
          borderWidth: 1,
        });

        for (let rowIndex = 0; rowIndex < fixedRowsPerPage; rowIndex += 1) {
          const row = pageRows[rowIndex];
          const yTop = pageHeight - rowIndex * rowHeight;
          const yBottom = yTop - rowHeight;

          if (rowIndex < fixedRowsPerPage - 1) {
            page.drawLine({
              start: { x: 0, y: yBottom },
              end: { x: pageWidth, y: yBottom },
              color: black,
              thickness: 1,
            });
          }

          page.drawLine({
            start: { x: bilColWidth, y: yBottom },
            end: { x: bilColWidth, y: yTop },
            color: black,
            thickness: 1,
          });

          if (!row) {
            continue;
          }

          const bilTextWidth = fontRegular.widthOfTextAtSize(row.bil, 12);
          page.drawText(row.bil, {
            x: (bilColWidth - bilTextWidth) / 2,
            y: yTop - mmToPt(22),
            size: 12,
            font: fontRegular,
            color: black,
          });

          const nameBandHeight = mmToPt(6);
          const contentX = bilColWidth + mmToPt(2);
          const nameY = yTop - nameBandHeight + mmToPt(1.8);

          page.drawLine({
            start: { x: bilColWidth, y: yTop - nameBandHeight },
            end: { x: pageWidth, y: yTop - nameBandHeight },
            color: black,
            thickness: 1,
          });

          page.drawText(row.nama, {
            x: contentX,
            y: nameY,
            size: 13,
            font: fontBold,
            color: black,
          });

          const maxAddressWidth = pageWidth - contentX - mmToPt(1);
          let currentY = yTop - nameBandHeight - mmToPt(6);
          for (const line of row.alamatLines) {
            const wrapped = wrapText(line, 12, maxAddressWidth, fontRegular);
            for (const wrappedLine of wrapped) {
              page.drawText(wrappedLine, {
                x: contentX,
                y: currentY,
                size: 12,
                font: fontRegular,
                color: black,
              });
              currentY -= mmToPt(4.2);
            }
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `alamat-tempahan-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast({
        title: 'PDF Alamat Dijana',
        description: 'PDF alamat A6 berjaya dijana dari draf tempahan.',
      });
    } catch {
      toast({
        title: 'Jana PDF Alamat Gagal',
        description: 'Ralat semasa jana PDF alamat.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Tempahan"
        description="."
      />

      <div className="grid gap-6 xl:grid-cols-[470px_1fr]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Borang Tempahan</CardTitle>
            <CardDescription>
              
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 pb-2 border-b">
              <Label>Pilih Modul</Label>
              <Select
                value={form.penerbitanId}
                onValueChange={(value) => {
                  const penerbitan = penerbitanOptions.find((p) => p.id === value);
                  if (!penerbitan) return;
                  setForm((cur) => ({
                    ...cur,
                    penerbitanId: value,
                    perkara: penerbitan.perkara,
                    tajuk: buildSebutHargaTitle(penerbitan.perkara),
                    hargaSeunit: String(penerbitan.hargaSeunit || lastHargaSeunit),
                    semester: `Semester ${penerbitan.semester}`,
                  }));
                }}
                onOpenChange={(open) => { if (open) void loadPenerbitanOptions(); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih modul dari Rekod Jualan" />
                </SelectTrigger>
                <SelectContent>
                  {penerbitanOptions
                    .filter((p) => p.aktif === 1)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.perkara}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {form.perkara && (
                <p className="text-xs text-muted-foreground">Tajuk sebut harga dan semester dijana automatik daripada modul.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Nama Penerima</Label>
              <CustomerAutocomplete
                value={form.namaPenerima}
                onValueChange={(value) => updateForm('namaPenerima', value)}
                onCustomerSelect={handleSelectCustomer}
              />
            </div>

            <div className="space-y-2">
              <Label>Nama Kolej Vokasional</Label>
              <KVAutocomplete
                value={form.namaKolejVokasional}
                onValueChange={(value) => updateForm('namaKolejVokasional', value)}
                onKVSelect={handleSelectKV}
              />
            </div>

            <div className="space-y-2">
              <div className="space-y-2">
                <Label htmlFor="tarikh">Tarikh</Label>
                <Input id="tarikh" type="date" value={form.tarikh} onChange={(e) => updateForm('tarikh', e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="kuantiti">Kuantiti</Label>
                <Input id="kuantiti" type="number" min="1" value={form.kuantiti} onChange={(e) => updateForm('kuantiti', e.target.value.replace(/\D/g, ''))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hargaSeunit">Harga Seunit</Label>
                <Input
                  id="hargaSeunit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.hargaSeunit}
                  onChange={(e) => updateForm('hargaSeunit', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hargaPostage">Harga Postage</Label>
                <Input id="hargaPostage" type="number" min="0" step="0.01" value={form.hargaPostage} onChange={(e) => updateForm('hargaPostage', e.target.value)} />
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              Jumlah Semasa: <span className="font-semibold">{toCurrency(jumlah)}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alamat">Alamat</Label>
              <Textarea id="alamat" value={form.alamat} onChange={(e) => updateForm('alamat', e.target.value)} className="min-h-[90px]" placeholder="Alamat untuk PDF alamat dan data parcel" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="poskod">Poskod</Label>
                <Input id="poskod" value={form.poskod} onChange={(e) => updateForm('poskod', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="noPhone">No Phone</Label>
                <Input id="noPhone" value={form.noPhone} onChange={(e) => updateForm('noPhone', e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bilanganAlamat">Bilangan Alamat</Label>
                <Input id="bilanganAlamat" type="number" min="1" value={form.bilanganAlamat} onChange={(e) => updateForm('bilanganAlamat', e.target.value.replace(/\D/g, ''))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bilanganParcel">Jumlah Parcel</Label>
                <Input id="bilanganParcel" type="number" min="1" value={form.bilanganParcel} onChange={(e) => updateForm('bilanganParcel', e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>

            <Button type="button" className="w-full" onClick={handleSaveTempahan} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Menyimpan Tempahan...' : 'Simpan Ke Draft Tempahan'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Draf Tempahan</CardTitle>
              <CardDescription>
                {isLoading
                  ? 'Memuatkan draf...'
                  : `${drafts.length} draf tempahan ${draftStatusView === 'active' ? 'semasa' : 'sejarah'}.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={draftStatusView === 'active' ? 'default' : 'outline'}
                  onClick={() => setDraftStatusView('active')}
                >
                  Semasa
                </Button>
                <Button
                  type="button"
                  variant={draftStatusView === 'archived' ? 'default' : 'outline'}
                  onClick={() => setDraftStatusView('archived')}
                >
                  Sejarah Tempahan
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleGenerateInvoiceZip} disabled={drafts.length === 0 || isGenerating}>
                  <FileArchive className="mr-2 h-4 w-4" />
                  Jana PDF Invois (ZIP)
                </Button>
                <Button type="button" variant="outline" onClick={handleGenerateAddressPdf} disabled={drafts.length === 0 || isGenerating}>
                  <Printer className="mr-2 h-4 w-4" />
                  Jana PDF Alamat
                </Button>
                <Button type="button" variant="outline" onClick={handleGenerateParcelXlsx} disabled={drafts.length === 0 || isGenerating}>
                  <Download className="mr-2 h-4 w-4" />
                  Jana XLSX Parcel
                </Button>
                <Button type="button" variant="outline" onClick={handleArchiveOrRestoreAll} disabled={drafts.length === 0 || isArchivingAll}>
                  {draftStatusView === 'active' ? <Archive className="mr-2 h-4 w-4" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  {isArchivingAll
                    ? 'Sedang Kemaskini...'
                    : draftStatusView === 'active'
                      ? 'Arkibkan Semua'
                      : 'Pulihkan Semua'}
                </Button>
                {draftStatusView === 'active' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleArchiveSelectedActive}
                    disabled={selectedActiveIds.length === 0 || isArchivingSelected}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    {isArchivingSelected ? 'Mengarkib...' : `Arkibkan Dipilih (${selectedActiveIds.length})`}
                  </Button>
                )}
              </div>

              {draftStatusView === 'archived' && (
                <div className="grid gap-3 rounded-md border border-border/70 p-3 md:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-1">
                    <Label htmlFor="archiveDateFrom">Tarikh Dari</Label>
                    <Input
                      id="archiveDateFrom"
                      type="date"
                      value={archiveDateFrom}
                      onChange={(e) => setArchiveDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="archiveDateTo">Tarikh Hingga</Label>
                    <Input
                      id="archiveDateTo"
                      type="date"
                      value={archiveDateTo}
                      onChange={(e) => setArchiveDateTo(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRestoreSelectedArchived}
                        disabled={selectedArchivedIds.length === 0 || isRestoringSelected || isDeletingSelectedArchived}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {isRestoringSelected ? 'Memulihkan...' : `Pulihkan Dipilih (${selectedArchivedIds.length})`}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDeleteSelectedArchived}
                        disabled={selectedArchivedIds.length === 0 || isDeletingSelectedArchived || isRestoringSelected}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {isDeletingSelectedArchived ? 'Memadam...' : `Delete Dipilih (${selectedArchivedIds.length})`}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {draftStatusView === 'archived' ? (
                        <TableHead className="w-[54px]">
                          <Checkbox
                            checked={
                              filteredDrafts.length > 0 &&
                              selectedArchivedIds.length === filteredDrafts.length
                            }
                            onCheckedChange={(checked) => handleToggleSelectAllArchived(Boolean(checked))}
                            aria-label="Pilih semua draf arkib"
                          />
                        </TableHead>
                      ) : (
                        <TableHead className="w-[54px]">
                          <Checkbox
                            checked={
                              filteredDrafts.length > 0 &&
                              selectedActiveIds.length === filteredDrafts.length
                            }
                            onCheckedChange={(checked) => handleToggleSelectAllActive(Boolean(checked))}
                            aria-label="Pilih semua draf semasa"
                          />
                        </TableHead>
                      )}
                      <TableHead>No Siri</TableHead>
                      <TableHead>Penerima</TableHead>
                      <TableHead>Bil. Alamat</TableHead>
                      <TableHead>Bil. Parcel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead className="text-right">Tindakan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDrafts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Belum ada draf tempahan.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDrafts.map((item) => (
                        <TableRow
                          key={item.id}
                          className={item.hargaPostage === 0 ? "bg-yellow-50 dark:bg-yellow-900/40" : ""}
                        >
                          {draftStatusView === 'archived' ? (
                            <TableCell>
                              <Checkbox
                                checked={selectedArchivedIds.includes(item.id)}
                                onCheckedChange={() => handleToggleArchivedSelection(item.id)}
                                aria-label={`Pilih draf ${item.noResit}`}
                              />
                            </TableCell>
                          ) : (
                            <TableCell>
                              <Checkbox
                                checked={selectedActiveIds.includes(item.id)}
                                onCheckedChange={() => handleToggleActiveSelection(item.id)}
                                aria-label={`Pilih draf ${item.noResit}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium">{item.noResit}</TableCell>
                          <TableCell>{item.namaPenerima}</TableCell>
                          <TableCell>{item.bilanganAlamat}</TableCell>
                          <TableCell>{item.bilanganParcel}</TableCell>
                          <TableCell>{item.status === 'archived' ? 'Sejarah' : 'Semasa'}</TableCell>
                          <TableCell className="text-right">
                            {toCurrency(item.kuantiti * item.hargaSeunit + item.hargaPostage)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {draftStatusView === 'archived' && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => handleUpdateDraftStatus(item.id, 'restore')}
                                  disabled={isDeletingId === item.id}
                                  title="Pulihkan draf"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => handleDeleteDraft(item.id)}
                                disabled={isDeletingId === item.id}
                                title="Padam draf"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
      </div>
    </div>
  );
}
