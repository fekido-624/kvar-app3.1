"use client";

import { useMemo, useState } from 'react';
import { Archive } from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { KVAutocomplete } from '@/components/kv-autocomplete';
import { useToast } from '@/hooks/use-toast';

type AddressEntry = {
  id: string;
  bil: string;
  kv: string;
  nama: string;
  alamat: string;
  poskod: string;
  noPhone: string;
  bilanganAlamat: number;
};

type PreviewRow = {
  id: string;
  bil: string;
  nama: string;
  alamatLines: string[];
};

type PendingCustomer = {
  kv: string;
  nama: string;
  alamat: string;
  poskod: string;
  noPhone: string;
};

const emptyForm = {
  bil: '',
  kv: '',
  nama: '',
  alamat: '',
  poskod: '',
  noPhone: '',
  bilanganAlamat: '',
};

type KVSelection = {
  id: string;
  name: string;
  address: string;
  postcode: string;
  phone: string;
  kodKV: string;
};

const buildAlamatLines = (entry: AddressEntry) => {
  const alamatParts = entry.alamat
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return [...alamatParts, entry.poskod.trim(), entry.noPhone.trim()].filter(Boolean);
};

const chunkRows = (rows: PreviewRow[], size: number) => {
  const chunks: PreviewRow[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
};

const isSamePendingCustomer = (left: PendingCustomer, right: PendingCustomer) =>
  left.kv === right.kv &&
  left.nama === right.nama &&
  left.alamat === right.alamat &&
  left.poskod === right.poskod &&
  left.noPhone === right.noPhone;

export default function AddressGeneratorPage() {
  const [form, setForm] = useState(emptyForm);
  const [entries, setEntries] = useState<AddressEntry[]>([]);
  const [archivedEntries, setArchivedEntries] = useState<AddressEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [pendingCustomers, setPendingCustomers] = useState<PendingCustomer[]>([]);
  const [isSavingPendingCustomer, setIsSavingPendingCustomer] = useState(false);
  const { toast } = useToast();
  const activePendingCustomer = pendingCustomers[0] ?? null;

  const bilCellStyle = {
    fontSize: '12px',
    lineHeight: 1,
    textAlign: 'center' as const,
  };

  const visibleEntries = activeTab === 'active' ? entries : archivedEntries;

  const previewRows = useMemo<PreviewRow[]>(
    () =>
      visibleEntries.flatMap((entry) =>
        Array.from({ length: entry.bilanganAlamat }, (_, copyIndex) => ({
          id: `${entry.id}-${copyIndex}`,
          bil: entry.bil,
          nama: entry.nama,
          alamatLines: buildAlamatLines(entry),
        }))
      ),
    [visibleEntries]
  );

  const previewPages = useMemo(() => chunkRows(previewRows, 3), [previewRows]);

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const updateForm = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const dismissPendingCustomer = () => {
    setPendingCustomers((current) => current.slice(1));
  };

  const queuePendingCustomer = (customer: PendingCustomer) => {
    setPendingCustomers((current) => {
      if (current.some((item) => isSamePendingCustomer(item, customer))) {
        return current;
      }
      return [...current, customer];
    });
  };

  const handleSelectKV = (item: KVSelection) => {
    setForm((current) => ({
      ...current,
      kv: item.kodKV,
      nama: item.name,
      alamat: item.address,
      poskod: item.postcode,
      noPhone: item.phone,
    }));
  };

  const checkCustomerExists = async (entry: AddressEntry) => {
    try {
      const response = await fetch('/api/customers/check-existing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: entry.nama,
          address: entry.alamat,
          postcode: entry.poskod,
          phone: entry.noPhone,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check customer');
      }

      const data = (await response.json()) as { exists?: boolean };

      if (!data.exists) {
        queuePendingCustomer({
          kv: entry.kv,
          nama: entry.nama,
          alamat: entry.alamat,
          poskod: entry.poskod,
          noPhone: entry.noPhone,
        });
      }
    } catch {
      toast({
        title: 'Semakan database gagal',
        description: 'Alamat tetap dimasukkan ke senarai. Jika perlu, semak dan tambah customer secara manual kemudian.',
        variant: 'destructive',
      });
    }
  };

  const handleSavePendingCustomer = async () => {
    if (!activePendingCustomer || !activePendingCustomer.kv.trim()) {
      return;
    }

    setIsSavingPendingCustomer(true);

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: activePendingCustomer.nama,
          address: activePendingCustomer.alamat,
          postcode: activePendingCustomer.poskod,
          phone: activePendingCustomer.noPhone,
          kodKV: activePendingCustomer.kv,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save customer');
      }

      toast({
        title: 'Customer disimpan',
        description: `${activePendingCustomer.nama} telah ditambah ke database customer.`,
      });
      dismissPendingCustomer();
    } catch {
      toast({
        title: 'Simpan customer gagal',
        description: 'Alamat kekal dalam senarai, tetapi customer baru tidak berjaya disimpan ke database.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPendingCustomer(false);
    }
  };

  const handleAddToList = () => {
    const bilanganAlamat = Number(form.bilanganAlamat);
    const hasBilanganAlamat = form.bilanganAlamat.trim().length > 0;
    const missingFields: string[] = [];

    if (!form.bil.trim()) missingFields.push('Bil');
    if (!form.nama.trim()) missingFields.push('Nama');
    if (!form.alamat.trim()) missingFields.push('Alamat');
    if (!form.poskod.trim()) missingFields.push('Poskod');
    if (!form.noPhone.trim()) missingFields.push('No. Phone');
    if (!hasBilanganAlamat) missingFields.push('Bilangan Alamat');

    const nextEntry: AddressEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      bil: form.bil.trim(),
      kv: form.kv.trim(),
      nama: form.nama.trim(),
      alamat: form.alamat.trim(),
      poskod: form.poskod.trim(),
      noPhone: form.noPhone.trim(),
      bilanganAlamat: Number.isInteger(bilanganAlamat) && bilanganAlamat > 0 ? bilanganAlamat : 1,
    };

    if (missingFields.length > 0) {
      toast({
        title: 'Form belum lengkap',
        description: `Sila lengkapkan field berikut: ${missingFields.join(', ')}.`,
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isInteger(bilanganAlamat) || bilanganAlamat < 1) {
      toast({
        title: 'Bilangan Alamat tidak sah',
        description: 'Bilangan Alamat mesti nombor 1 atau lebih.',
        variant: 'destructive',
      });
      return;
    }

    if (
      !nextEntry.bil ||
      !nextEntry.nama ||
      !nextEntry.alamat ||
      !nextEntry.poskod ||
      !nextEntry.noPhone ||
      !hasBilanganAlamat ||
      !Number.isInteger(bilanganAlamat) ||
      bilanganAlamat < 1
    ) {
      toast({
        title: 'Form tidak sah',
        description: 'Semak semula input yang dimasukkan sebelum tambah ke senarai.',
        variant: 'destructive',
      });
      return;
    }

    setEntries((current) => [...current, nextEntry]);
    setActiveTab('active');
    setForm(emptyForm);
    void checkCustomerExists(nextEntry);
  };

  const handleMoveEntry = (entryId: string, action: 'archive' | 'restore') => {
    if (action === 'archive') {
      const target = entries.find((entry) => entry.id === entryId);
      if (!target) return;
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
      setArchivedEntries((current) => [...current, target]);
      return;
    }

    const target = archivedEntries.find((entry) => entry.id === entryId);
    if (!target) return;
    setArchivedEntries((current) => current.filter((entry) => entry.id !== entryId));
    setEntries((current) => [...current, target]);
  };

  const handleMoveAllEntries = (action: 'archive-all' | 'restore-all') => {
    if (action === 'archive-all') {
      if (entries.length === 0) return;
      setArchivedEntries((current) => [...current, ...entries]);
      setEntries([]);
      return;
    }

    if (archivedEntries.length === 0) return;
    setEntries((current) => [...current, ...archivedEntries]);
    setArchivedEntries([]);
  };

  const handleExportPdfA6 = () => {
    if (previewRows.length === 0) return;

    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) return;

    const pageHtml = previewPages
      .map((pageRows) => {
        const rowHtml = pageRows
          .map((row) => {
            const alamatHtml = row.alamatLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('');
            return `
              <tr>
                <td class="bil">${escapeHtml(row.bil)}</td>
                <td class="alamat-cell">
                  <div class="nama">${escapeHtml(row.nama)}</div>
                  <div class="alamat">${alamatHtml}</div>
                </td>
              </tr>
            `;
          })
          .join('');

        return `
          <div class="sheet">
            <table>
              <colgroup>
                <col class="bil-col" />
                <col />
              </colgroup>
              <tbody>${rowHtml}</tbody>
            </table>
          </div>
        `;
      })
      .join('');

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Address A6</title>
          <style>
            @page {
              size: A6 portrait;
              margin: 0;
            }
            html, body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            body {
              display: flex;
              flex-direction: column;
              gap: 0;
            }
            .sheet {
              width: 105mm;
              height: 148mm;
              page-break-after: always;
            }
            .sheet:last-child {
              page-break-after: auto;
            }
            table {
              width: 100%;
              height: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              font-size: 14px;
            }
            col.bil-col {
              width: 14mm;
            }
            tr {
              height: calc(148mm / 3);
            }
            td {
              border: 1px solid #000;
              vertical-align: top;
            }
            .bil {
              font-size: 12px;
              text-align: center;
              vertical-align: middle;
              padding: 0 2mm;
              line-height: 1;
            }
            .nama {
              border-bottom: 1px solid #000;
              padding: 1.2mm 2mm;
              font-weight: 700;
              text-decoration: underline;
            }
            .alamat {
              padding: 1.2mm 2mm;
              line-height: 1.1;
            }
          </style>
        </head>
        <body>${pageHtml}</body>
      </html>
    `);

    popup.document.close();
    popup.focus();
    popup.print();
  };

  const handleExportPdfA6Direct = async () => {
    if (previewRows.length === 0) return;

    const mmToPt = (mm: number) => (mm * 72) / 25.4;

    const pageWidth = mmToPt(105);
    const pageHeight = mmToPt(148);
    const bilColWidth = mmToPt(14);
    const fontNameSize = 14;
    const fontAddressSize = 14;
    const bilSize = 12;

    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const black = rgb(0, 0, 0);
    const borderWidth = 1;

    const wrapText = (text: string, fontSize: number, maxWidth: number): string[] => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = fontRegular.widthOfTextAtSize(testLine, fontSize);

        if (width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines.length > 0 ? lines : [text];
    };

    previewPages.forEach((pageRows) => {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const rowHeight = pageHeight / pageRows.length;

      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        borderColor: black,
        borderWidth,
      });

      pageRows.forEach((row, rowIndex) => {
        const yTop = pageHeight - rowIndex * rowHeight;
        const yBottom = yTop - rowHeight;

        if (rowIndex < pageRows.length - 1) {
          page.drawLine({
            start: { x: 0, y: yBottom },
            end: { x: pageWidth, y: yBottom },
            color: black,
            thickness: borderWidth,
          });
        }

        page.drawLine({
          start: { x: bilColWidth, y: yBottom },
          end: { x: bilColWidth, y: yTop },
          color: black,
          thickness: borderWidth,
        });

        const bilTextWidth = fontRegular.widthOfTextAtSize(row.bil, bilSize);
        page.drawText(row.bil, {
          x: (bilColWidth - bilTextWidth) / 2,
          y: yBottom + rowHeight / 2 - bilSize / 2,
          size: bilSize,
          font: fontRegular,
          color: black,
        });

        const nameBandHeight = mmToPt(6);
        const nameX = bilColWidth + mmToPt(2);
        const nameY = yTop - nameBandHeight + mmToPt(1.8);
        const maxAddressWidth = pageWidth - nameX - mmToPt(1);

        page.drawLine({
          start: { x: bilColWidth, y: yTop - nameBandHeight },
          end: { x: pageWidth, y: yTop - nameBandHeight },
          color: black,
          thickness: borderWidth,
        });

        page.drawText(row.nama, {
          x: nameX,
          y: nameY,
          size: fontNameSize,
          font: fontBold,
          color: black,
        });

        const nameWidth = fontBold.widthOfTextAtSize(row.nama, fontNameSize);
        page.drawLine({
          start: { x: nameX, y: nameY - 1 },
          end: { x: nameX + nameWidth, y: nameY - 1 },
          color: black,
          thickness: 0.8,
        });

        const addressTopGap = mmToPt(6);
        const addressLineHeight = mmToPt(4.2);
        let currentY = yTop - nameBandHeight - addressTopGap;

        row.alamatLines.forEach((line) => {
          const wrappedLines = wrapText(line, fontAddressSize, maxAddressWidth);
          wrappedLines.forEach((wrappedLine) => {
            page.drawText(wrappedLine, {
              x: nameX,
              y: currentY,
              size: fontAddressSize,
              font: fontRegular,
              color: black,
            });
            currentY -= addressLineHeight;
          });
        });
      });
    });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'address-a6-direct.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in">
      <AlertDialog
        open={Boolean(activePendingCustomer)}
        onOpenChange={(open) => {
          if (!open && activePendingCustomer && !isSavingPendingCustomer) {
            dismissPendingCustomer();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Simpan customer baru?</AlertDialogTitle>
            <AlertDialogDescription>
              Maklumat ini belum dijumpai dalam database customer. Alamat sudah dimasukkan ke senarai. Jika mahu,
              anda boleh simpan <strong>{activePendingCustomer?.nama ?? '-'}</strong> sebagai customer baru.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
            <div><span className="font-medium">KV:</span> {activePendingCustomer?.kv || '-'}</div>
            <div><span className="font-medium">Poskod:</span> {activePendingCustomer?.poskod || '-'}</div>
            <div><span className="font-medium">No. Phone:</span> {activePendingCustomer?.noPhone || '-'}</div>
          </div>
          {!activePendingCustomer?.kv ? (
            <p className="text-sm text-destructive">Kod KV belum diisi. Isi KV jika anda mahu simpan customer ini ke database.</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingPendingCustomer}>Tak Perlu</AlertDialogCancel>
            <AlertDialogAction
              disabled={!activePendingCustomer?.kv || isSavingPendingCustomer}
              onClick={(event) => {
                event.preventDefault();
                void handleSavePendingCustomer();
              }}
            >
              {isSavingPendingCustomer ? 'Menyimpan...' : 'Ya, Simpan Customer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PageHeader
        title="Penjana Alamat"
        description="Isi butiran manual, tambah ke senarai, kemudian jana atau eksport PDF A6."
      />

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Kemasukan Manual</CardTitle>
            <CardDescription>Isi maklumat alamat secara manual sebelum tambah ke senarai.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bil">No Order / Bil</Label>
              <Input id="bil" value={form.bil} onChange={(e) => updateForm('bil', e.target.value)} placeholder="Contoh: 51" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kv">KV</Label>
              <KVAutocomplete
                value={form.kv}
                onValueChange={(value) => updateForm('kv', value)}
                onKVSelect={handleSelectKV}
                placeholder="Cari Kod KV"
              />
              <p className="text-xs text-muted-foreground">Pilih KV untuk auto isi Nama, Alamat, Poskod dan No. Phone.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nama">Nama</Label>
              <Input id="nama" value={form.nama} onChange={(e) => updateForm('nama', e.target.value)} placeholder="Contoh: Pn. Nur Syahira bt Hamzah" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alamat">Alamat</Label>
              <Textarea
                id="alamat"
                value={form.alamat}
                onChange={(e) => updateForm('alamat', e.target.value)}
                placeholder={"Contoh:\nKolej Vokasional Pagoh,\nJalan Renchong-Gombang,\nPagoh Muar, Johor"}
                className="min-h-[110px]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="poskod">Poskod</Label>
                <Input id="poskod" value={form.poskod} onChange={(e) => updateForm('poskod', e.target.value)} placeholder="Contoh: 84600" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="noPhone">No. Phone</Label>
                <Input id="noPhone" value={form.noPhone} onChange={(e) => updateForm('noPhone', e.target.value)} placeholder="Contoh: 601118772367" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bilanganAlamat">Bilangan Alamat</Label>
              <Input
                id="bilanganAlamat"
                type="number"
                min="1"
                value={form.bilanganAlamat}
                onChange={(e) => updateForm('bilanganAlamat', e.target.value.replace(/\D/g, ''))}
                placeholder="Contoh: 3"
                required
              />
              <p className="text-xs text-muted-foreground">Jika isi 3, customer ini akan dijana 3 kali. Satu A6 hanya muat 3 alamat.</p>
            </div>

            <Button type="button" className="w-full" onClick={handleAddToList}>
              Tambah Ke Senarai
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Senarai Untuk Jana PDF</CardTitle>
              <CardDescription>
                {visibleEntries.length} item dalam {activeTab === 'active' ? 'Semasa' : 'Sejarah'}.
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
                <Button
                  type="button"
                  variant="outline"
                  className="ml-auto gap-2"
                  onClick={() => handleMoveAllEntries(activeTab === 'active' ? 'archive-all' : 'restore-all')}
                  disabled={visibleEntries.length === 0}
                >
                  <Archive size={16} />
                  {activeTab === 'active' ? 'Arkib Semua' : 'Pulih Semua'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleEntries.length === 0 ? (
                <div className="rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground">
                  {activeTab === 'active'
                    ? 'Belum ada data semasa. Isi form di sebelah kiri dan tekan `Tambah Ke Senarai`.'
                    : 'Belum ada data sejarah alamat.'}
                </div>
              ) : (
                visibleEntries.map((entry, index) => (
                  <div key={entry.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{index + 1}. {entry.nama}</div>
                      <div className="text-sm text-muted-foreground">Bil: {entry.bil} | KV: {entry.kv || '-'} | Poskod: {entry.poskod} | Phone: {entry.noPhone} | Bilangan Alamat: {entry.bilanganAlamat}</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleMoveEntry(entry.id, activeTab === 'active' ? 'archive' : 'restore')}
                    >
                      {activeTab === 'active' ? 'Arkib' : 'Pulih'}
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleExportPdfA6} disabled={visibleEntries.length === 0}>
              Eksport PDF (A6)
            </Button>
            <Button type="button" variant="outline" onClick={handleExportPdfA6Direct} disabled={visibleEntries.length === 0}>
              Eksport PDF A6 (Terus)
            </Button>
          </div>

          {previewPages.map((pageRows, pageIndex) => (
            <div key={`page-${pageIndex}`} className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Pratonton Halaman {pageIndex + 1} ({pageRows.length}/3 alamat)</div>
              <div
                className="rounded-md border bg-white overflow-hidden"
                style={{ width: '105mm', height: '148mm' }}
              >
                <table className="w-full h-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '14mm' }} />
                    <col />
                  </colgroup>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr key={row.id} style={{ height: `calc(148mm / ${pageRows.length || 1})` }}>
                        <td className="border border-black px-1 align-middle" style={bilCellStyle}>{row.bil}</td>
                        <td className="border border-black p-0 align-top">
                          <div className="border-b border-black px-2 py-1 font-bold underline">
                            {row.nama}
                          </div>
                          <div className="px-2 py-1 leading-tight">
                            {row.alamatLines.map((line, index) => (
                              <div key={`${row.id}-${index}`}>{line}</div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
