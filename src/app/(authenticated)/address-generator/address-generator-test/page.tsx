"use client";

import { useMemo, useState } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { KVAutocomplete } from '@/components/kv-autocomplete';
import { CustomerAutocomplete } from '@/components/customer-autocomplete';

type KVSelection = {
  id: string;
  name: string;
  address: string;
  postcode: string;
  phone: string;
  kodKV: string;
};

type CustomerSelection = {
  id: string;
  name: string;
  kodKV: string;
  address?: string;
  postcode?: string;
  phone?: string;
};

const emptyForm = {
  bil: '',
  kv: '',
  nama: '',
  alamat: '',
  poskod: '',
  noPhone: '',
  bilanganAlamat: '1',
};

type AlamatEntry = typeof emptyForm & { id: number };

type PreviewRow = {
  id: string;
  bil: string;
  nama: string;
  alamatLines: string[];
};

const buildAlamatLines = (entry: AlamatEntry) => {
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

export default function AddressGeneratorTestPage() {
	const [form, setForm] = useState(emptyForm);
	const [senarai, setSenarai] = useState<AlamatEntry[]>(() => {
		if (typeof window === 'undefined') return [];
		try {
			const saved = localStorage.getItem('senarai-alamat');
			return saved ? JSON.parse(saved) : [];
		} catch {
			return [];
		}
	});
	const [selected, setSelected] = useState<Set<number>>(new Set());
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const updateSenarai = (next: AlamatEntry[]) => {
		setSenarai(next);
		localStorage.setItem('senarai-alamat', JSON.stringify(next));
	};

	const toggleSelected = (id: number) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const selectAll = () => {
		setSelected(new Set(senarai.map((e) => e.id)));
	};

	const deselectAll = () => {
		setSelected(new Set());
	};

	const handleDeleteSelected = () => {
		const remaining = senarai.filter((e) => !selected.has(e.id));
		updateSenarai(remaining);
		setSelected(new Set());
		setShowDeleteConfirm(false);
	};

	const updateForm = (field: keyof typeof emptyForm, value: string) => {
		setForm((current) => ({ ...current, [field]: value }));
	};

	const applySelection = (payload: {
		kv?: string;
		nama?: string;
		alamat?: string;
		poskod?: string;
		noPhone?: string;
	}) => {
		setForm((current) => ({
			...current,
			kv: payload.kv ?? current.kv,
			nama: payload.nama ?? current.nama,
			alamat: payload.alamat ?? current.alamat,
			poskod: payload.poskod ?? current.poskod,
			noPhone: payload.noPhone ?? current.noPhone,
		}));
	};

	const handleSelectKV = (item: KVSelection) => {
		applySelection({
			kv: item.kodKV,
			nama: item.name,
			alamat: item.address,
			poskod: item.postcode,
			noPhone: item.phone,
		});
	};

	const handleSelectNama = (item: CustomerSelection) => {
		applySelection({
			nama: item.name,
			kv: item.kodKV,
			alamat: item.address ?? '',
			poskod: item.postcode ?? '',
			noPhone: item.phone ?? '',
		});
	};

	const handleSubmit = () => {
		if (!form.nama && !form.alamat) return;
		updateSenarai([...senarai, { ...form, id: Date.now() }]);
		setForm(emptyForm);
	};

	const handleRemove = (id: number) => {
		updateSenarai(senarai.filter((e) => e.id !== id));
	};

	const previewRows = useMemo<PreviewRow[]>(
		() =>
			senarai
				.filter((entry) => selected.has(entry.id))
				.flatMap((entry) =>
					Array.from({ length: parseInt(entry.bilanganAlamat, 10) || 1 }, (_, copyIndex) => ({
						id: `${entry.id}-${copyIndex}`,
						bil: entry.bil,
						nama: entry.nama,
						alamatLines: buildAlamatLines(entry),
					}))
				),
		[senarai, selected]
	);

	const previewPages = useMemo(() => chunkRows(previewRows, 3), [previewRows]);

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
			const rowHeight = pageHeight / 3;

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

				if (rowIndex < 2) {
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
		const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
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
			<AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Padam {selected.size} item?</AlertDialogTitle>
						<AlertDialogDescription>
							Tindakan ini tidak boleh dibatalkan. Item yang dipilih akan dipadamkan dari senarai.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
						<AlertDialogCancel>Batal</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteSelected}>
							Padam
						</AlertDialogAction>
					</div>
				</AlertDialogContent>
			</AlertDialog>

			<PageHeader
				title="Penjana Alamat Test"
				description="Isi maklumat untuk jana alamat. KV dan Nama menyokong auto search + auto fill data berkaitan."
			/>

			<div className="flex gap-6 items-start">
				{/* Borang */}
				<Card className="w-full max-w-sm border-none shadow-sm shrink-0">
					<CardHeader>
						<CardTitle>Borang Maklumat Alamat</CardTitle>
						<CardDescription>
							No order, KV, nama, alamat dan bilangan alamat untuk proses jana alamat.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="bil">No order / Bil</Label>
							<Input
								id="bil"
								value={form.bil}
								onChange={(e) => updateForm('bil', e.target.value)}
								placeholder="Contoh: 51"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="kv">KV (Auto Search)</Label>
							<KVAutocomplete
								value={form.kv}
								onValueChange={(value) => updateForm('kv', value)}
								onKVSelect={handleSelectKV}
								placeholder="Cari Kod KV"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="nama">Nama (Auto Search)</Label>
							<CustomerAutocomplete
								value={form.nama}
								onValueChange={(value) => updateForm('nama', value)}
								onCustomerSelect={handleSelectNama}
								placeholder="Cari nama pelanggan"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="alamat">Alamat</Label>
							<Textarea
								id="alamat"
								value={form.alamat}
								onChange={(e) => updateForm('alamat', e.target.value)}
								placeholder={"Diisi automatik bila pilih KV/Nama. Boleh edit jika perlu."}
								className="min-h-[110px]"
							/>
						</div>

						<div className="grid gap-4 grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="poskod">Poskod</Label>
								<Input
									id="poskod"
									value={form.poskod}
									onChange={(e) => updateForm('poskod', e.target.value)}
									placeholder="Diisi automatik"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="noPhone">No.Phone</Label>
								<Input
									id="noPhone"
									value={form.noPhone}
									onChange={(e) => updateForm('noPhone', e.target.value)}
									placeholder="Diisi automatik"
								/>
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
							/>
						</div>

						<Button className="w-full" onClick={handleSubmit}>
							Tambah ke Senarai
						</Button>
					</CardContent>
				</Card>

				{/* Senarai Alamat */}
				<Card className="flex-1 border-none shadow-sm">
					<CardHeader className="flex flex-row items-center justify-between pb-3">
						<div>
							<CardTitle>Senarai Alamat</CardTitle>
							<CardDescription>
								{senarai.length === 0 ? 'Tiada rekod lagi.' : `${selected.size} / ${senarai.length} dipilih`}
							</CardDescription>
						</div>
						<Button 
							variant="outline" 
							onClick={handleExportPdfA6Direct} 
							disabled={selected.size === 0}
							size="sm"
						>
							Eksport PDF A6 (Terus)
						</Button>
					</CardHeader>
					<CardContent className="space-y-3">
						{senarai.length === 0 && (
							<p className="text-sm text-muted-foreground">Isi borang dan tekan <strong>Tambah ke Senarai</strong>.</p>
						)}
						{senarai.length > 0 && (
							<div className="flex gap-2 pb-2 border-b">
								<Button 
									variant="ghost" 
									size="sm" 
									onClick={selectAll}
									className="text-xs"
								>
									Pilih Semua
								</Button>
								<Button 
									variant="ghost" 
									size="sm" 
									onClick={deselectAll}
									className="text-xs"
								>
									Batal Pilihan
								</Button>
								<Button 
									variant="destructive" 
									size="sm" 
									onClick={() => setShowDeleteConfirm(true)}
									disabled={selected.size === 0}
									className="text-xs ml-auto"
								>
									Padam Dipilih ({selected.size})
								</Button>
							</div>
						)}
						{senarai.map((entry) => (
							<div key={entry.id} className="rounded-md border p-3 text-sm space-y-1 relative flex items-start gap-3">
								<input 
									type="checkbox"
									checked={selected.has(entry.id)}
									onChange={() => toggleSelected(entry.id)}
									className="mt-1 cursor-pointer"
								/>
								<div className="flex-1">
									<p className="font-medium">{entry.bil}. {entry.nama} {entry.kv ? `(${entry.kv})` : ''}</p>
									{entry.bilanganAlamat && entry.bilanganAlamat !== '1' && (
										<p className="text-muted-foreground">Bilangan: {entry.bilanganAlamat}</p>
									)}
								</div>
								<button
									onClick={() => handleRemove(entry.id)}
									className="text-muted-foreground hover:text-destructive text-xs flex-shrink-0"
								>
									✕
								</button>
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
