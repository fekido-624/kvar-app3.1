"use client";

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { buildSebutHargaTitle, formatSemesterDisplay } from '@/lib/module-text';

export type TempahanEditDraft = {
  id: string; revision: string; noResit: string; penerbitanId: string;
  namaPenerima: string; namaKolejVokasional: string; alamat: string; poskod: string; noPhone: string;
  tajuk: string; perkara: string; semester: string; tarikh: string;
  kuantiti: number; hargaSeunit: number; hargaPostage: number; bilanganAlamat: number; bilanganParcel: number;
};
type Publication = { id:string; perkara:string; semester:number; tahun:number; edisi:number; hargaSeunit:number; aktif:number };
const textFields = [
  ['Nama penerima','namaPenerima',true], ['Nama KV','namaKolejVokasional',true],
  ['Telefon','noPhone',false], ['Poskod','poskod',false], ['Perkara','perkara',true],
  ['Tajuk','tajuk',false], ['Semester','semester',false],
] as const;
const numberFields = [
  ['Kuantiti','kuantiti','1',1,1000000], ['Harga seunit (RM)','hargaSeunit','0.01',0,99999999],
  ['Postage (RM)','hargaPostage','0.01',0,99999999], ['Bilangan alamat','bilanganAlamat','1',1,10000],
  ['Bilangan parcel','bilanganParcel','1',1,10000],
] as const;
export function TempahanEditDialog({ draft, publications, onClose, onSaved }: {
  draft: TempahanEditDraft | null; publications: Publication[]; onClose:()=>void; onSaved:()=>Promise<void>;
}) {
  const [form, setForm] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(()=>{
    if (!draft) return;
    setForm(Object.fromEntries(Object.entries(draft).map(([key,value])=>[key,String(value)])));
    setError('');
  },[draft]);
  const update = (key:string,value:string)=>setForm(current=>({...current,[key]:value}));
  const total = Number(form.kuantiti || 0)*Number(form.hargaSeunit || 0)+Number(form.hargaPostage || 0);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!draft || saving) return;
    setSaving(true); setError('');
    try {
      const payload: Record<string,unknown> = { action:'edit', revision:draft.revision, penerbitanId:form.penerbitanId, alamat:form.alamat, tarikh:form.tarikh };
      for (const [,key] of textFields) payload[key] = form[key];
      for (const [,key] of numberFields) payload[key] = Number(form[key]);
      const response = await fetch(`/api/tempahan/drafts/${draft.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || 'Suntingan gagal disimpan.'); return; }
      onClose(); await onSaved();
    } catch { setError('Ralat rangkaian. Semak sambungan dan cuba lagi.'); }
    finally { setSaving(false); }
  }
  return <Dialog open={Boolean(draft)} onOpenChange={open=>{if(!open&&!saving)onClose();}}>
    <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto p-4 sm:w-full sm:max-w-2xl sm:p-6" onInteractOutside={event=>{if(saving)event.preventDefault();}} onEscapeKeyDown={event=>{if(saving)event.preventDefault();}}>
      <DialogHeader><DialogTitle>Edit Draf Tempahan</DialogTitle><DialogDescription>Betulkan maklumat draf. No. Tempahan dikekalkan; profil pelanggan dan taging lama tidak diubah.</DialogDescription></DialogHeader>
      <form onSubmit={save}>
        <fieldset disabled={saving} className="space-y-4">
          <div><Label htmlFor="edit-noResit">No. Tempahan</Label><Input id="edit-noResit" value={draft?.noResit || ''} readOnly /></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {textFields.map(([label,key,required])=><div key={key}><Label htmlFor={`edit-${key}`}>{label}</Label><Input id={`edit-${key}`} value={form[key] || ''} onChange={e=>update(key,e.target.value)} required={required}/></div>)}
            <div><Label htmlFor="edit-tarikh">Tarikh tempahan</Label><Input id="edit-tarikh" type="date" required value={form.tarikh || ''} onChange={e=>update('tarikh',e.target.value)}/></div>
          </div>
          <div><Label htmlFor="edit-alamat">Alamat</Label><Textarea id="edit-alamat" value={form.alamat || ''} onChange={e=>update('alamat',e.target.value)}/></div>
          <div><Label htmlFor="edit-penerbitan">Penerbitan</Label>
            <select id="edit-penerbitan" className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.penerbitanId || ''} onChange={e=>{
              const p=publications.find(p=>p.id===e.target.value);
              if(p)setForm(current=>({...current,penerbitanId:p.id,perkara:p.perkara,tajuk:buildSebutHargaTitle(p.perkara),semester:formatSemesterDisplay(p.semester),hargaSeunit:String(p.hargaSeunit)}));
            }}>
              {!draft?.penerbitanId&&<option value="">Tanpa pautan penerbitan (rekod lama)</option>}
              {form.penerbitanId&&!publications.some(p=>p.id===form.penerbitanId)&&<option value={form.penerbitanId}>Penerbitan semasa (tidak tersedia)</option>}
              {publications.filter(p=>p.aktif||p.id===draft?.penerbitanId).map(p=><option key={p.id} value={p.id} disabled={!p.aktif}>{p.perkara} · {p.tahun} · Semester {p.semester} · Edisi {p.edisi}{!p.aktif?' (tidak aktif)':''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {numberFields.map(([label,key,step,min,max])=><div key={key}><Label htmlFor={`edit-${key}`}>{label}</Label><Input id={`edit-${key}`} type="number" step={step} min={min} max={max} required value={form[key] || ''} onChange={e=>update(key,e.target.value)}/></div>)}
          </div>
          <p className="font-semibold">Jumlah: RM {Number.isFinite(total)?total.toFixed(2):'0.00'}</p>
          <p className="text-sm text-muted-foreground">Postage RM0 tidak memerlukan rekod parcel. Jika diubah ke RM0, draf parcel berkaitan dikeluarkan; alamat dan telefon kekal pada tempahan.</p>
          {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit">{saving?'Menyimpan…':'Simpan Perubahan'}</Button></DialogFooter>
        </fieldset>
      </form>
    </DialogContent>
  </Dialog>;
}
