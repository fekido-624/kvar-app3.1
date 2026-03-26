"use client";

import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

export default function AddressGeneratorTestPage() {
	const [form, setForm] = useState(emptyForm);

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

	return (
		<div className="animate-fade-in">
			<PageHeader
				title="Penjana Alamat Test"
				description="Isi maklumat untuk jana alamat. KV dan Nama menyokong auto search + auto fill data berkaitan."
			/>

			<Card className="max-w-3xl border-none shadow-sm">
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

					<div className="grid gap-4 md:grid-cols-2">
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
				</CardContent>
			</Card>
		</div>
	);
}
