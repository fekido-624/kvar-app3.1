"use client";

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
import { ReceiptDraft, ReceiptTajukOption } from '@/lib/types';
import { Archive, Printer, RotateCcw, Save } from 'lucide-react';
import { CustomerAutocomplete } from '@/components/customer-autocomplete';
import { KVAutocomplete } from '@/components/kv-autocomplete';
import { buildSebutHargaTitle, extractSemesterLabelFromPerkara } from '@/lib/module-text';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const toCurrency = (value: number) => `RM ${value.toFixed(2)}`;

type ActivePerkaraOption = {
  id: string;
  label: string;
};

export default function ResitTestPage() {
    // Harga seunit custom, tidak dihantar ke excel dan tidak refer modul
    const [hargaSeunitCustom, setHargaSeunitCustom] = useState('');
  const [noResit, setNoResit] = useState('');
  const [noSeriSebatHarga, setNoSeriSebatHarga] = useState('');
  const [namaPenerima, setNamaPenerima] = useState('');
  const [namaKolejVokasional, setNamaKolejVokasional] = useState('');
  const [tajuk, setTajuk] = useState('');
  const [perkara, setPerkara] = useState('');
  const [kuantiti, setKuantiti] = useState('1');
  const [hargaSeunit, setHargaSeunit] = useState('');
  const [hargaPostage, setHargaPostage] = useState('0');
  const [tarikh, setTarikh] = useState(new Date().toISOString().slice(0, 10));
  const [semester, setSemester] = useState('');

  const [perkaraOptions, setPerkaraOptions] = useState<ActivePerkaraOption[]>([]);
  const [penerbitanRows, setPenerbitanRows] = useState<Array<Record<string, unknown>>>([]);
  const [newPerkaraOption, setNewPerkaraOption] = useState('');
  const [selectedPerkaraOptionId, setSelectedPerkaraOptionId] = useState('');

  const [tajukOptions, setTajukOptions] = useState<ReceiptTajukOption[]>([]);
  const [newTajukOption, setNewTajukOption] = useState('');
  const [selectedTajukOptionId, setSelectedTajukOptionId] = useState('');

  const [receiptDrafts, setReceiptDrafts] = useState<ReceiptDraft[]>([]);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSavingPerkaraOption, setIsSavingPerkaraOption] = useState(false);
  const [isSavingTajukOption, setIsSavingTajukOption] = useState(false);
  const [isExportingPdfZip, setIsExportingPdfZip] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [isUpdatingDraftId, setIsUpdatingDraftId] = useState<string | null>(null);
  const [isUpdatingAllDrafts, setIsUpdatingAllDrafts] = useState(false);
  const [isResettingNoResit, setIsResettingNoResit] = useState(false);
  const [isResettingSebatHarga, setIsResettingSebatHarga] = useState(false);
  const [resetStartNo, setResetStartNo] = useState('1');
  const [resetStartNoSebatHarga, setResetStartNoSebatHarga] = useState('1');

  const { toast } = useToast();

  const jumlah = useMemo(() => {
    const qty = Number(kuantiti) || 0;
    const unit = Number(hargaSeunit) || 0;
    const postage = Number(hargaPostage) || 0;
    return qty * unit + postage;
  }, [kuantiti, hargaSeunit, hargaPostage]);

  const filteredReceiptDrafts = useMemo(
    () => receiptDrafts,
    [receiptDrafts]
  );

  const loadDrafts = async () => {
    const response = await fetch(`/api/receipts?status=${activeTab}`, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    const receipts = data.receipts ?? [];
    setReceiptDrafts(receipts);
    setNoResit(data.nextNoResit ?? '0001');
    setNoSeriSebatHarga(data.nextNoSeriSebatHarga ?? '001');
  };

  const loadPerkaraOptions = async () => {
    const response = await fetch('/api/penerbitan', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    const rows = Array.isArray(data.penerbitan) ? data.penerbitan : [];

    setPenerbitanRows(rows);

    const byLabel = new Map<string, ActivePerkaraOption>();
    for (const row of rows as Array<Record<string, unknown>>) {
      if (Number(row.aktif ?? 0) !== 1) continue;
      const label = String(row.perkara ?? '').trim();
      if (!label) continue;
      if (!byLabel.has(label)) {
        byLabel.set(label, {
          id: String(row.id ?? label),
          label,
        });
      }
    }

    setPerkaraOptions(Array.from(byLabel.values()).sort((a, b) => a.label.localeCompare(b.label)));
  };

  const loadTajukOptions = async () => {
    const response = await fetch('/api/receipt-tajuk', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setTajukOptions(data.options ?? []);
  };

  useEffect(() => {
    loadDrafts();
  }, [activeTab]);

  useEffect(() => {
    loadPerkaraOptions();
    loadTajukOptions();
  }, []);

  useEffect(() => {
    if (!perkara.trim()) {
      setTajuk('');
      setSemester('');
      return;
    }
    setTajuk(buildSebutHargaTitle(perkara));
    setSemester(extractSemesterLabelFromPerkara(perkara));
  }, [perkara]);

  const resetForm = () => {
    setNamaPenerima('');
    setNamaKolejVokasional('');
    setKuantiti('1');
    // setHargaSeunit(''); // Jangan reset harga seunit, biar kekal
    setHargaPostage('0');
    setTarikh(new Date().toISOString().slice(0, 10));
    setSemester('');
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
          setPerkara(data.option.label);
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
        setPerkara(created.option.label);
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
    if (deletedOption && perkara === deletedOption.label) {
      setPerkara('');
    }

    setSelectedPerkaraOptionId('');
    await loadPerkaraOptions();
    toast({
      title: 'Perkara Deleted',
      description: 'Perkara option removed from dropdown menu.',
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
          setTajuk(data.option.label);
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
        setTajuk(created.option.label);
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
    if (deletedOption && tajuk === deletedOption.label) {
      setTajuk('');
    }

    setSelectedTajukOptionId('');
    await loadTajukOptions();
    toast({
      title: 'Tajuk Deleted',
      description: 'Tajuk option removed from dropdown menu.',
    });
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSavingDraft(true);

    let hargaSeunitValue = hargaSeunit !== '' ? Number(hargaSeunit) : 0;
    if (!perkara) {
      hargaSeunitValue = 0;
    }

    const payload = {
      namaPenerima,
      namaKolejVokasional,
      tajuk,
      perkara,
      kuantiti: Number(kuantiti),
      hargaSeunit: hargaSeunitValue,
      hargaPostage: Number(hargaPostage),
      tarikh,
      semester,
    };

    const response = await fetch('/api/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast({
        title: 'Simpan Resit Gagal',
        description: data.error ?? `Tidak dapat simpan draf resit (HTTP ${response.status}).`,
        variant: 'destructive',
      });
      setIsSavingDraft(false);
      return;
    }

    await loadDrafts();
    setIsSavingDraft(false);
    resetForm();
    toast({
      title: 'Resit Disimpan',
      description: 'Draf resit berjaya disimpan ke senarai. Anda boleh tambah pelanggan seterusnya.',
    });
  };

  const handleUpdateDraftStatus = async (receiptId: string, action: 'archive' | 'restore') => {
    setIsUpdatingDraftId(receiptId);
    try {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        toast({
          title: action === 'archive' ? 'Arkib Gagal' : 'Pulih Gagal',
          description: action === 'archive' ? 'Tidak dapat arkibkan draf resit.' : 'Tidak dapat pulihkan draf resit.',
          variant: 'destructive',
        });
        return;
      }

      await loadDrafts();
      toast({
        title: action === 'archive' ? 'Resit Diarkibkan' : 'Resit Dipulihkan',
        description:
          action === 'archive'
            ? 'Draf resit dipindahkan ke Sejarah.'
            : 'Draf resit dipindahkan ke Semasa.',
      });
    } catch {
      toast({
        title: action === 'archive' ? 'Arkib Gagal' : 'Pulih Gagal',
        description: 'Ralat network/server semasa kemas kini status draf.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingDraftId(null);
    }
  };

  const handleUpdateAllDraftsStatus = async (action: 'archive_all' | 'restore_all') => {
    if (filteredReceiptDrafts.length === 0 || isUpdatingAllDrafts) return;

    const confirmed = window.confirm(
      action === 'archive_all'
        ? 'Pindahkan semua draf semasa ke Sejarah?'
        : 'Pulihkan semua draf sejarah ke Semasa?'
    );
    if (!confirmed) return;

    setIsUpdatingAllDrafts(true);
    try {
      const response = await fetch('/api/receipts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        toast({
          title: action === 'archive_all' ? 'Arkib Gagal' : 'Pulih Gagal',
          description:
            action === 'archive_all'
              ? 'Tidak dapat arkibkan semua draf resit.'
              : 'Tidak dapat pulihkan semua draf resit.',
          variant: 'destructive',
        });
        return;
      }

      await loadDrafts();
      toast({
        title: action === 'archive_all' ? 'Semua Draf Diarkibkan' : 'Semua Draf Dipulihkan',
        description:
          action === 'archive_all'
            ? 'Semua draf semasa dipindahkan ke Sejarah.'
            : 'Semua draf sejarah dipulihkan ke Semasa.',
      });
    } catch {
      toast({
        title: action === 'archive_all' ? 'Arkib Gagal' : 'Pulih Gagal',
        description: 'Ralat network/server semasa kemas kini semua draf.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingAllDrafts(false);
    }
  };

  const handleSelectCustomer = (customer: {
    id: string;
    name: string;
    kodKV: string;
    address?: string;
    postcode?: string;
    phone?: string;
  }) => {
    setNamaPenerima(customer.name);
    handleFillNamaKV(customer.kodKV);
  };

  const handleFillNamaKV = (kodKV: string) => {
    setNamaKolejVokasional(kodKV);
  };

  const handleSelectKV = (item: { id: string; name: string; kodKV: string }) => {
    setNamaKolejVokasional(item.kodKV);
    setNamaPenerima(item.name);
  };

  const handleResetNoResit = async () => {
    const value = Number(resetStartNo);
    if (!Number.isInteger(value) || value < 1 || value > 999999) {
      toast({
        title: 'Nilai Tidak Sah',
        description: 'Masukkan nombor mula antara 1 hingga 999999.',
        variant: 'destructive',
      });
      return;
    }

    setIsResettingNoResit(true);
    try {
      let response = await fetch('/api/receipts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startNo: value, resetType: 'resit' }),
      });

      if (!response.ok && response.status === 404) {
        response = await fetch('/api/receipts/reset-counter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startNo: value }),
        });
      }

      if (!response.ok) {
        const text = await response.text();
        let data: { error?: string } = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text?.slice(0, 200) };
        }
        toast({
          title: 'Reset Gagal',
          description: data.error ?? `Tidak dapat reset no siri resit (HTTP ${response.status}).`,
          variant: 'destructive',
        });
        return;
      }

      await loadDrafts();
      toast({
        title: 'Reset Berjaya',
        description: `No siri resit set semula. Nombor seterusnya: ${String(value).padStart(4, '0')}.`,
      });
    } catch {
      toast({
        title: 'Reset Gagal',
        description: 'Ralat network/server semasa reset no siri resit.',
        variant: 'destructive',
      });
    } finally {
      setIsResettingNoResit(false);
    }
  };

  const handleResetSebatHarga = async () => {
    const value = Number(resetStartNoSebatHarga);
    if (!Number.isInteger(value) || value < 1 || value > 999) {
      toast({
        title: 'Nilai Tidak Sah',
        description: 'Masukkan nombor mula antara 1 hingga 999.',
        variant: 'destructive',
      });
      return;
    }

    setIsResettingSebatHarga(true);
    try {
      const response = await fetch('/api/receipts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startNo: value, resetType: 'sebat_harga' }),
      });

      if (!response.ok) {
        const text = await response.text();
        let data: { error?: string } = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text?.slice(0, 200) };
        }
        toast({
          title: 'Reset Gagal',
          description: data.error ?? `Tidak dapat reset no siri sebut harga (HTTP ${response.status}).`,
          variant: 'destructive',
        });
        return;
      }

      await loadDrafts();
      toast({
        title: 'Reset Berjaya',
        description: `No siri sebut harga set semula. Nombor seterusnya: ${String(value).padStart(3, '0')}.`,
      });
    } catch {
      toast({
        title: 'Reset Gagal',
        description: 'Ralat network/server semasa reset no siri sebut harga.',
        variant: 'destructive',
      });
    } finally {
      setIsResettingSebatHarga(false);
    }
  };

  const handleExportDraftPdfZip = async () => {
    setIsExportingPdfZip(true);
    try {
      const response = await fetch(`/api/receipts/export-pdf?status=${activeTab}`, { method: 'GET' });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast({
          title: 'Eksport PDF Gagal',
          description: data.error ?? 'Tidak dapat menjana fail PDF ZIP.',
          variant: 'destructive',
        });
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') ?? '';
      const matchedName = contentDisposition.match(/filename="?([^\"]+)"?/i)?.[1];
      const fileName = matchedName ?? `invoice-pdf-export-${Date.now()}.zip`;

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Eksport PDF Berjaya',
        description: 'Semua draft telah dijana sebagai PDF dan dimuat turun dalam fail ZIP.',
      });
    } catch {
      toast({
        title: 'Eksport PDF Gagal',
        description: 'Ralat rangkaian/pelayan semasa eksport PDF ZIP.',
        variant: 'destructive',
      });
    } finally {
      setIsExportingPdfZip(false);
    }
  };

  return (
    <div className="animate-fade-in print:animate-none">
      <div className="print:hidden">
        <PageHeader
          title="Generate Resit"
          description="Isi maklumat resit, simpan ke draft, dan eksport PDF ZIP."
        />
      </div>

      <form onSubmit={handleSaveDraft} className="space-y-6 print:hidden">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Maklumat Resit</CardTitle>
            <CardDescription></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="noResit">No Siri Resit (4-6 angka)</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="noResit"
                    value={noResit}
                    disabled
                    readOnly
                    className="max-w-[180px]"
                  />
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="gap-1">
                        <RotateCcw size={14} />
                        Reset
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reset No Siri Resit</DialogTitle>
                        <DialogDescription>
                          Tetapkan nombor mula baru untuk penjanaan automatik no siri.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <Label htmlFor="resetStartNo">Nombor Mula (1 - 999999)</Label>
                        <Input
                          id="resetStartNo"
                          inputMode="numeric"
                          maxLength={6}
                          value={resetStartNo}
                          onChange={(e) => setResetStartNo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Contoh: 1"
                        />
                        <Button
                          type="button"
                          onClick={handleResetNoResit}
                          disabled={isResettingNoResit || !resetStartNo}
                          className="w-full"
                        >
                          {isResettingNoResit ? 'Sedang Reset...' : 'Simpan Reset'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <p className="text-xs text-muted-foreground"></p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="noSeriSebatHarga">No Siri Sebut Harga (3 angka)</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="noSeriSebatHarga"
                    value={noSeriSebatHarga}
                    disabled
                    readOnly
                    className="max-w-[180px]"
                  />
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="gap-1">
                        <RotateCcw size={14} />
                        Reset
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reset No Siri Sebut Harga</DialogTitle>
                        <DialogDescription>
                          Tetapkan nombor mula baru untuk penjanaan automatik no siri sebut harga.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3">
                        <Label htmlFor="resetStartNoSebatHarga">Nombor Mula (1 - 999)</Label>
                        <Input
                          id="resetStartNoSebatHarga"
                          inputMode="numeric"
                          maxLength={3}
                          value={resetStartNoSebatHarga}
                          onChange={(e) => setResetStartNoSebatHarga(e.target.value.replace(/\D/g, '').slice(0, 3))}
                          placeholder="Contoh: 1"
                        />
                        <Button
                          type="button"
                          onClick={handleResetSebatHarga}
                          disabled={isResettingSebatHarga || !resetStartNoSebatHarga}
                          className="w-full"
                        >
                          {isResettingSebatHarga ? 'Sedang Reset...' : 'Simpan Reset'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <p className="text-xs text-muted-foreground"></p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="namaPenerima">Nama Penerima</Label>
                <CustomerAutocomplete
                  value={namaPenerima}
                  onValueChange={setNamaPenerima}
                  onCustomerSelect={handleSelectCustomer}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="namaKolejVokasional">Nama Kolej Vokasional</Label>
                <KVAutocomplete
                  value={namaKolejVokasional}
                  onValueChange={setNamaKolejVokasional}
                  onKVSelect={handleSelectKV}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tajuk (Untuk Sebut Harga)</Label>
              <Input value={tajuk} readOnly placeholder="Auto generate dari modul (Perkara)" />
            </div>

            <div className="space-y-2">
              <Label>Perkara</Label>
              <div className="grid grid-cols-1 gap-2">
                <Select
                  value={perkara}
                  onValueChange={(value) => {
                    setPerkara(value);
                    const selected = perkaraOptions.find((opt) => opt.label === value);
                    setSelectedPerkaraOptionId(selected?.id ?? '');

                    // Cari hargaSeunit dari penerbitanRows
                    const penerbitan = penerbitanRows.find((row) => String(row.perkara ?? '').trim() === value);
                    if (penerbitan && typeof penerbitan.hargaSeunit === 'number') {
                      setHargaSeunit(String(penerbitan.hargaSeunit));
                    } else {
                      setHargaSeunit('');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih modul dari Rekod Jualan" />
                  </SelectTrigger>
                  <SelectContent>
                    {perkaraOptions.map((option) => (
                      <SelectItem key={option.id} value={option.label}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Perkara diambil daripada modul yang telah dicipta di Rekod Jualan.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="kuantiti">Kuantiti</Label>
                <Input id="kuantiti" type="number" min="1" value={kuantiti} onChange={(e) => setKuantiti(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hargaSeunit">Harga Seunit</Label>
                <Input id="hargaSeunit" type="number" min="0" step="0.01" value={hargaSeunit} onChange={(e) => setHargaSeunit(e.target.value)} required/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hargaSeunitCustom">Harga Seunit (Custom)</Label>
                <Input id="hargaSeunitCustom" type="number" min="0" step="0.01" value={hargaSeunitCustom} onChange={(e) => setHargaSeunitCustom(e.target.value)} placeholder="Boleh edit, tidak dihantar ke excel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hargaPostage">Harga Postage</Label>
                <Input id="hargaPostage" type="number" min="0" step="0.01" value={hargaPostage} onChange={(e) => setHargaPostage(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tarikh">Tarikh</Label>
                <Input id="tarikh" type="date" value={tarikh} onChange={(e) => setTarikh(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Jumlah</Label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-semibold">
                {toCurrency(jumlah)}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="gap-2" disabled={isSavingDraft}>
                <Save size={16} />
                {isSavingDraft ? 'Menyimpan...' : 'Simpan Ke Senarai'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card className="mt-6 border-none shadow-sm print:hidden">
        <CardHeader>
          <CardTitle>Senarai Draft Resit</CardTitle>
          <CardDescription>
            {activeTab === 'active'
              ? 'Resit semasa yang sedia untuk eksport atau diarkib.'
              : 'Sejarah resit yang telah diarkibkan.'}
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              type="button"
              variant={activeTab === 'active' ? 'default' : 'outline'}
              onClick={() => setActiveTab('active')}
            >
              Semasa
            </Button>
            <Button
              type="button"
              variant={activeTab === 'archived' ? 'default' : 'outline'}
              onClick={() => setActiveTab('archived')}
            >
              Sejarah
            </Button>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                type="button"
                className="gap-2"
                onClick={handleExportDraftPdfZip}
                disabled={isExportingPdfZip || filteredReceiptDrafts.length === 0}
              >
                <Printer size={16} />
                {isExportingPdfZip ? 'Menjana PDF ZIP...' : `Eksport PDF ZIP (${filteredReceiptDrafts.length})`}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() =>
                  handleUpdateAllDraftsStatus(activeTab === 'active' ? 'archive_all' : 'restore_all')
                }
                disabled={isUpdatingAllDrafts || filteredReceiptDrafts.length === 0}
              >
                <Archive size={16} />
                {isUpdatingAllDrafts
                  ? activeTab === 'active'
                    ? 'Mengarkibkan...'
                    : 'Memulihkan...'
                  : activeTab === 'active'
                    ? 'Arkib Semua'
                    : 'Pulih Semua'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>No Resit</TableHead>
                  <TableHead>Penerima</TableHead>
                  <TableHead>Kolej</TableHead>
                  <TableHead>Tarikh</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Tindakan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceiptDrafts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {activeTab === 'active' ? 'Belum ada draft resit semasa.' : 'Belum ada sejarah resit.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReceiptDrafts.map((item) => {
                    const total = item.kuantiti * item.hargaSeunit + item.hargaPostage;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.noResit}</TableCell>
                        <TableCell className="font-medium">{item.namaPenerima}</TableCell>
                        <TableCell>{item.namaKolejVokasional}</TableCell>
                        <TableCell>{new Date(item.tarikh).toLocaleDateString()}</TableCell>
                        <TableCell>{item.semester}</TableCell>
                        <TableCell className="text-right">{toCurrency(total)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            onClick={() =>
                              handleUpdateDraftStatus(item.id, activeTab === 'active' ? 'archive' : 'restore')
                            }
                            disabled={isUpdatingDraftId === item.id}
                          >
                            {isUpdatingDraftId === item.id
                              ? activeTab === 'active'
                                ? 'Arkib...'
                                : 'Pulih...'
                              : activeTab === 'active'
                                ? 'Arkib'
                                : 'Pulih'}
                          </Button>
                        </TableCell>
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