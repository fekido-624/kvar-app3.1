'use client';
import { SearchInput } from '@/components/search-input';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Archive, Download, Eye, Pencil, RotateCcw, Tags, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { lebihanTagSchema, type LebihanTagInput, type LebihanTagRecord, type TagPreviewPage } from '@/lib/lebihan-tags';

type Match = Pick<LebihanTagInput, 'noOrder' | 'name' | 'kv' | 'address' | 'postcode' | 'phone' | 'sourceType' | 'sourceId'> & { noResit?: string; semester?: string };
const emptyForm = {
  noOrder: '', name: '', kv: '', address: '', postcode: '', phone: '',
  lebihan: '0', naskahGuru: '0', sourceType: 'manual' as LebihanTagInput['sourceType'], sourceId: '',
};

async function jsonResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Permintaan gagal. Cuba semula.');
  return data;
}

export default function TagingLebihanPage() {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<'order' | 'customer'>('order');
  const [lookupQuery, setLookupQuery] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [lookupMessage, setLookupMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const lookupRequest = useRef<AbortController | null>(null);
  const lookupVersion = useRef(0);
  const cancelLookup = () => { lookupVersion.current++; lookupRequest.current?.abort(); setSearching(false); setMatches([]); setLookupMessage(''); };
  useEffect(() => () => { lookupVersion.current++; lookupRequest.current?.abort(); }, []);
  const [tags, setTags] = useState<LebihanTagRecord[]>([]);
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfTitle, setPdfTitle] = useState('');
  const [previewPages, setPreviewPages] = useState<TagPreviewPage[]>([]);

  const report = (error: unknown) => toast({ title: 'Tidak berjaya', description: error instanceof Error ? error.message : 'Cuba semula.', variant: 'destructive' });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    setSelected([]);
    setPage(1);
    const timer = setTimeout(async () => {
      try {
        const data = await jsonResponse(await fetch(`/api/taging-lebihan?status=${status}&q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: 'no-store' }));
        setTags(data.tags);
      } catch (error) {
        if (!controller.signal.aborted) {
          setTags([]);
          setLoadError(error instanceof Error ? error.message : 'Gagal memuatkan rekod.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [status, query, refresh]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  useEffect(() => {
    if (pdfUrl) document.getElementById('tag-pdf')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pdfUrl]);

  const applyMatch = (match: Match) => {
    cancelLookup();
    setForm((current) => ({ ...current, ...match, noOrder: match.noOrder || current.noOrder }));
    setLookupMessage(`Dipilih: ${match.name} — ${match.kv}. Semak maklumat di bawah.`);
    setMatches([]);
  };

  const lookup = async (query: string) => {
    cancelLookup();
    const version = lookupVersion.current;
    const controller = new AbortController();
    lookupRequest.current = controller;
    setLookupQuery(query);
    if (!query) { setMatches([]); setLookupMessage(''); return; }
    setSearching(true);
    setMatches([]);
    setLookupMessage('');
    if (mode === 'order') setForm((current) => ({ ...current, noOrder: query,
      name: '', kv: '', address: '', postcode: '', phone: '', sourceType: 'manual', sourceId: '' }));
    try {
      const data = await jsonResponse(await fetch(`/api/taging-lebihan/lookup?mode=${mode}&q=${encodeURIComponent(query)}`, { cache: 'no-store', signal: controller.signal }));
      if (version !== lookupVersion.current) return;
      if (data.matches.length === 1) applyMatch(data.matches[0]);
      else {
        setMatches(data.matches);
        setLookupMessage(data.matches.length ? `${data.matches.length} padanan. Pilih penerima yang betul.${data.truncated ? ' Had 50 padanan; perincikan carian.' : ''}` : mode === 'order' ? 'No Tempahan tidak dijumpai. Cuba carian Nama / KV.' : 'Tiada customer dijumpai. Cuba nama atau KV lain.');
      }
    } catch (error) { if (version === lookupVersion.current && !controller.signal.aborted) report(error); }
    finally { if (version === lookupVersion.current) setSearching(false); }
  };

  const parsedForm = (): LebihanTagInput => {
    const parsed = lebihanTagSchema.safeParse({ ...form,
      lebihan: form.lebihan.trim() === '' ? NaN : Number(form.lebihan),
      naskahGuru: form.naskahGuru.trim() === '' ? NaN : Number(form.naskahGuru),
    });
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    return parsed.data;
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const data = parsedForm();
      setBusy(true);
      await jsonResponse(await fetch(editingId ? `/api/taging-lebihan/${editingId}` : '/api/taging-lebihan', {
        method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      }));
      toast({ title: editingId ? 'Tag dikemas kini' : 'Tag disimpan', description: 'Maklumat customer dan tempahan asal kekal.' });
      cancelLookup();
      if (!editingId) { setStatus('active'); setQuery(''); }
      setForm(emptyForm); setEditingId(null); setLookupMessage(''); setMatches([]); setLookupQuery('');
      setRefresh((current) => current + 1);
    } catch (error) { report(error); }
    finally { setBusy(false); }
  };

  const edit = (tag: LebihanTagRecord) => {
    cancelLookup();
    setForm({ noOrder: tag.noOrder, name: tag.name, kv: tag.kv, address: tag.address, postcode: tag.postcode, phone: tag.phone,
      lebihan: String(tag.lebihan), naskahGuru: String(tag.naskahGuru), sourceType: tag.sourceType, sourceId: tag.sourceId });
    setEditingId(tag.id); setMatches([]); setLookupMessage('');
    document.getElementById('tag-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const changeStatus = async () => {
    setBusy(true);
    try {
      const data = await jsonResponse(await fetch('/api/taging-lebihan', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected, action: status === 'active' ? 'archive' : 'restore' }) }));
      toast({ title: `${data.updated} rekod ${status === 'active' ? 'diarkibkan' : 'dipulihkan'}` });
      setRefresh((current) => current + 1);
    } catch (error) { report(error); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const data = await jsonResponse(await fetch('/api/taging-lebihan', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: deleteIds }) }));
      toast({ title: `${data.deleted} rekod dipadam kekal` });
      if (editingId && deleteIds.includes(editingId)) { setForm(emptyForm); setEditingId(null); }
      setDeleteIds([]); setRefresh((current) => current + 1);
    } catch (error) { report(error); }
    finally { setBusy(false); }
  };

  const preview = async (saved: boolean) => {
    try {
      const body = saved ? { ids: tags.filter((tag) => selected.includes(tag.id)).map((tag) => tag.id) } : { preview: parsedForm() };
      setBusy(true);
      const response = await fetch('/api/taging-lebihan/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
      const data = await jsonResponse(response);
      const bytes = Uint8Array.from(atob(data.pdf), (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      setPreviewPages(data.pages);
      setPdfUrl(url); setPdfTitle(saved ? `${selected.length} tempahan dipilih` : `No Tempahan ${form.noOrder} — pratonton borang`);
    } catch (error) { report(error); }
    finally { setBusy(false); }
  };

  const visible = tags.slice((page - 1) * 20, page * 20);
  const pageCount = Math.max(1, Math.ceil(tags.length / 20));
  const allVisibleSelected = visible.length > 0 && visible.every((tag) => selected.includes(tag.id));
  const select = (ids: string[], checked: boolean) => {
    const next = checked ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id));
    if (next.length > 200) { report(new Error('Pilih maksimum 200 rekod untuk satu tindakan.')); return; }
    setSelected(next);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Taging Lebihan" description="Label Lebihan dan Naskah Guru dalam satu kertas A6 landscape." />

      {pdfUrl && <Card id="tag-pdf" className="scroll-mt-20">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle>Pratonton cetakan</CardTitle><CardDescription>{pdfTitle}</CardDescription></div>
            <div className="flex gap-2"><Button asChild><a href={pdfUrl} download="taging-lebihan-a6.pdf"><Download className="mr-2 h-4 w-4" />Muat turun PDF</a></Button><Button variant="outline" onClick={() => setPdfUrl('')}>Tutup</Button></div>
          </div>
          <p className="text-sm text-muted-foreground">Cetak A6 landscape, skala 100% / Actual size. Potong mengikut garisan tengah. Kuantiti 0 meninggalkan ruang kosong.</p>
        </CardHeader>
        <CardContent className="max-h-[650px] space-y-5 overflow-auto rounded-md bg-muted/30 p-4">
          {previewPages.map((sheet, index) => <div key={index} className="mx-auto max-w-2xl space-y-2">
            <p className="text-xs text-muted-foreground">Halaman {index + 1} / {previewPages.length}</p>
            <svg role="img" aria-label={`Pratonton label halaman ${index + 1}`} viewBox={`0 0 ${sheet.width} ${sheet.height}`} className="w-full border bg-white text-black shadow-sm" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
              <line x1={sheet.margin} y1={sheet.height / 2} x2={sheet.width - sheet.margin} y2={sheet.height / 2} stroke="#999" strokeWidth="0.5" strokeDasharray="3 3" />
              {sheet.frame.map((stroke, strokeIndex) => <line key={`frame-${strokeIndex}`} x1={stroke.x1} y1={sheet.height - stroke.y1} x2={stroke.x2} y2={sheet.height - stroke.y2} stroke="black" strokeWidth={stroke.thickness} />)}
              {sheet.lines.map((line, lineIndex) => <text key={lineIndex} x={line.x} y={sheet.height - line.y} fontSize={line.size} fontWeight={line.bold ? 'bold' : 'normal'} fill="black">{line.text}</text>)}
            </svg>
          </div>)}
        </CardContent>
      </Card>}

      <Card>
      <CardHeader><CardTitle>Cari penerima</CardTitle><CardDescription>Cari nombor penuh dari Tempahan (kolum No Siri), atau pilih customer melalui Nama / KV.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2" role="group" aria-label="Jenis carian">
            <Button type="button" disabled={searching} variant={mode === 'order' ? 'default' : 'outline'} aria-pressed={mode === 'order'} onClick={() => { setMode('order'); setMatches([]); setLookupMessage(''); }}>No Tempahan</Button>
            <Button type="button" disabled={searching} variant={mode === 'customer' ? 'default' : 'outline'} aria-pressed={mode === 'customer'} onClick={() => { setMode('customer'); setMatches([]); setLookupMessage(''); }}>Nama / KV</Button>
          </div>
          <SearchInput id="lookup-query" label={mode === 'order' ? 'Cari No Tempahan' : 'Cari Nama atau KV'} value={lookupQuery}
            loading={searching} onSearch={lookup} onValueChange={(next) => { cancelLookup(); setLookupQuery(next); }}
            placeholder={mode === 'order' ? 'Contoh: 5025 (No Tempahan / No Siri)' : 'Taip nama customer atau KV'} />
          {lookupMessage && <p role="status" className="text-sm text-muted-foreground">{lookupMessage}</p>}
          {matches.length > 0 && <ul className="max-h-72 space-y-2 overflow-auto" aria-label="Padanan penerima">
            {matches.map((match) => <li key={`${match.sourceType}-${match.sourceId}`}><button type="button" onClick={() => applyMatch(match)} className="w-full rounded-md border p-3 text-left hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <span className="block font-medium">{match.name} · {match.kv}</span>
              <span className="block text-sm text-muted-foreground">{match.noOrder ? `No Tempahan ${match.noOrder} · ` : ''}{match.phone}</span>
              {match.noResit && <span className="block text-sm text-muted-foreground">No Siri {match.noResit}{match.semester ? ` · ${match.semester}` : ''}</span>}
              <span className="block text-sm text-muted-foreground">{match.address} {match.postcode}</span>
            </button></li>)}
          </ul>}
        </CardContent>
      </Card>

      <Card id="tag-form" className="scroll-mt-20">
        <CardHeader><CardTitle>{editingId ? 'Sunting rekod tag' : 'Maklumat tag baharu'}</CardTitle><CardDescription>Semak penerima sebelum simpan. Suntingan di sini hanya untuk tag ini.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-5">
            <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
              {([
                ['noOrder', 'No Tempahan', 80], ['name', 'Nama penerima', 160], ['kv', 'KV', 160],
                ['phone', 'No. telefon', 60], ['postcode', 'Poskod', 20],
              ] as const).map(([key, title, max]) => <div key={key} className="space-y-2"><Label htmlFor={`tag-${key}`}>{title}</Label><Input id={`tag-${key}`} required maxLength={max} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></div>)}
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="tag-address">Alamat</Label><Textarea id="tag-address" required maxLength={600} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="tag-lebihan">Lebihan (naskah)</Label><Input id="tag-lebihan" type="number" required min="0" max="1000000" step="1" value={form.lebihan} onChange={(event) => setForm((current) => ({ ...current, lebihan: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="tag-naskahGuru">Naskah Guru (naskah)</Label><Input id="tag-naskahGuru" type="number" required min="0" max="1000000" step="1" value={form.naskahGuru} onChange={(event) => setForm((current) => ({ ...current, naskahGuru: event.target.value }))} /></div>
            </fieldset>
            <p className="text-sm text-muted-foreground">Lebihan di atas, Naskah Guru di bawah. Kuantiti 0 tidak dicetak; sekurang-kurangnya satu kuantiti mesti melebihi 0.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}><Tags className="mr-2 h-4 w-4" />{busy ? 'Memproses…' : editingId ? 'Simpan perubahan' : 'Simpan tag'}</Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => preview(false)}><Eye className="mr-2 h-4 w-4" />Pratonton borang</Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => { setForm(emptyForm); setEditingId(null); setLookupMessage(''); setMatches([]); setLookupQuery(''); }}>{editingId ? 'Batal sunting' : 'Kosongkan borang'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rekod Taging Lebihan</CardTitle><CardDescription>Pilih beberapa rekod untuk satu PDF. Setiap tempahan mendapat satu halaman A6.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Status rekod">
            <Button variant={status === 'active' ? 'default' : 'outline'} aria-pressed={status === 'active'} onClick={() => setStatus('active')}>Aktif</Button>
            <Button variant={status === 'archived' ? 'default' : 'outline'} aria-pressed={status === 'archived'} onClick={() => setStatus('archived')}>Arkib</Button>
          </div>
          <div className="space-y-2"><Label htmlFor="tag-search">Cari rekod {status === 'active' ? 'aktif' : 'arkib'}</Label><SearchInput id="tag-search" label="Cari rekod tag" value={query} onSearch={setQuery} placeholder="No Tempahan, nama, KV atau telefon" /></div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-sm text-muted-foreground" aria-live="polite">{selected.length} dipilih · {loading ? 'Memuatkan…' : `${tags.length} rekod`}</span>
            <Button variant="outline" disabled={busy || loading || !selected.length} onClick={() => preview(true)}><Eye className="mr-2 h-4 w-4" />PDF pilihan</Button>
            <Button variant="outline" disabled={busy || loading || !selected.length} onClick={changeStatus}>{status === 'active' ? <Archive className="mr-2 h-4 w-4" /> : <RotateCcw className="mr-2 h-4 w-4" />}{status === 'active' ? 'Arkibkan' : 'Pulihkan'}</Button>
            <Button variant="destructive" disabled={busy || loading || !selected.length} onClick={() => setDeleteIds([...selected])}><Trash2 className="mr-2 h-4 w-4" />Padam kekal</Button>
          </div>
          {loadError ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{loadError}</p><Button variant="outline" onClick={() => setRefresh((current) => current + 1)}>Cuba semula</Button></div> : <Table>
            <TableHeader><TableRow>
              <TableHead><Checkbox aria-label="Pilih semua rekod pada halaman ini" disabled={loading || busy || !visible.length} checked={allVisibleSelected ? true : visible.some((tag) => selected.includes(tag.id)) ? 'indeterminate' : false} onCheckedChange={(checked) => select(visible.map((tag) => tag.id), checked === true)} /></TableHead>
              <TableHead>No Tempahan</TableHead><TableHead>Penerima / KV</TableHead><TableHead>Lebihan</TableHead><TableHead>Naskah Guru</TableHead><TableHead>Tindakan</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={6} className="py-8 text-center">Memuatkan rekod…</TableCell></TableRow> : !visible.length ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{query ? 'Tiada rekod sepadan dengan carian.' : status === 'active' ? 'Belum ada tag. Cari penerima dan simpan tag pertama.' : 'Belum ada rekod dalam arkib.'}</TableCell></TableRow> : visible.map((tag) => <TableRow key={tag.id}>
                <TableCell><Checkbox aria-label={`Pilih ${tag.noOrder} ${tag.name}`} checked={selected.includes(tag.id)} disabled={busy} onCheckedChange={(checked) => select([tag.id], checked === true)} /></TableCell>
                <TableCell className="font-medium">{tag.noOrder}</TableCell>
                <TableCell><span className="block font-medium">{tag.name}</span><span className="block text-sm text-muted-foreground">{tag.kv}</span></TableCell>
                <TableCell>{tag.lebihan}</TableCell><TableCell>{tag.naskahGuru}</TableCell>
                <TableCell><Button variant="ghost" size="sm" disabled={busy} onClick={() => edit(tag)}><Pencil className="mr-2 h-4 w-4" />Sunting</Button></TableCell>
              </TableRow>)}
            </TableBody>
          </Table>}
          <div className="flex items-center justify-between gap-2 text-sm"><span>Halaman {page} / {pageCount}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}>Sebelum</Button><Button variant="outline" size="sm" disabled={loading || page >= pageCount} onClick={() => setPage((current) => current + 1)}>Seterusnya</Button></div></div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteIds.length > 0} onOpenChange={(open) => { if (!open && !busy) setDeleteIds([]); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Padam {deleteIds.length} rekod tag secara kekal?</AlertDialogTitle><AlertDialogDescription>Rekod yang dipadam tidak boleh dipulihkan. Gunakan Arkib jika mahu menyimpannya untuk kegunaan kemudian. Data customer dan tempahan asal kekal.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel><Button variant="destructive" disabled={busy} onClick={remove}>{busy ? 'Memadam…' : 'Ya, padam kekal'}</Button></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
