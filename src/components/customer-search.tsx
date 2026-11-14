'use client';
import { useEffect, useRef, useState } from 'react';
import { SearchInput } from '@/components/search-input';

export type CustomerMatch = { id: string; name: string; kodKV: string; address: string; postcode: string; phone: string };
type Props = { value: string; onValueChange: (value: string) => void; onSelect: (customer: CustomerMatch) => void; field: 'name' | 'kodKV'; placeholder?: string; required?: boolean };

export function CustomerSearch({ value, onValueChange, onSelect, field, placeholder, required }: Props) {
  const [matches, setMatches] = useState<CustomerMatch[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const invalidate = () => { generation.current++; request.current?.abort(); setMatches([]); setMessage(''); setLoading(false); };
  useEffect(() => { invalidate(); }, [value]);
  useEffect(() => () => { generation.current++; request.current?.abort(); }, []);
  const pick = (customer: CustomerMatch) => { invalidate(); onValueChange(customer[field]); onSelect(customer); };
  const search = async (query: string) => {
    invalidate();
    if (!query) return;
    const current = generation.current;
    const controller = new AbortController(); request.current = controller;
    setLoading(true);
    try {
      const response = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, { cache: 'no-store', signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Carian gagal. Cuba semula.');
      if (current !== generation.current) return;
      const found: CustomerMatch[] = data.customers ?? [];
      if (found.length === 1 && !data.truncated) { pick(found[0]); return; }
      setMatches(found);
      setMessage(found.length ? `${found.length} padanan. Pilih penerima yang betul.${data.truncated ? ' Had 50 padanan; perincikan carian.' : ''}` : 'Tiada padanan. Cuba nama / KV lain atau isi secara manual.');
    } catch (error) {
      if (current === generation.current && !controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Carian gagal. Cuba semula.');
    } finally { if (current === generation.current) setLoading(false); }
  };
  return <div className="space-y-2">
    <SearchInput value={value} onValueChange={(next) => { invalidate(); onValueChange(next); }} onSearch={search} label={field === 'name' ? 'Nama penerima' : 'Nama atau kod KV'} placeholder={placeholder} required={required} loading={loading} />
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    {matches.length > 0 && <ul aria-label="Padanan pelanggan" className="max-h-72 space-y-2 overflow-auto">
      {matches.map((customer) => <li key={customer.id}><button type="button" onClick={() => pick(customer)} className="w-full rounded-md border bg-background p-3 text-left hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <span className="block text-sm font-medium">{customer.name} · {customer.kodKV}</span><span className="block text-sm text-muted-foreground">{customer.phone}</span><span className="block text-sm text-muted-foreground">{customer.address} {customer.postcode}</span>
      </button></li>)}
    </ul>}
  </div>;
}
