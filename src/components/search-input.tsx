'use client';
import { useEffect, useId, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = { value: string; onSearch: (query: string) => void; onValueChange?: (value: string) => void; id?: string; label?: string; placeholder?: string; required?: boolean; loading?: boolean; className?: string };

export function SearchInput({ value, onSearch, onValueChange, id, label = 'Carian', placeholder = 'Taip carian…', required, loading, className = '' }: Props) {
  const generatedId = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const submit = () => onSearch(draft.trim());
  return <div className={`flex min-w-0 flex-wrap gap-2 sm:flex-nowrap ${className}`}>
    <Input id={id || generatedId} aria-label={label} value={draft} placeholder={placeholder} required={required} maxLength={160}
      onChange={(event) => { setDraft(event.target.value); onValueChange?.(event.target.value); }}
      onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); submit(); } }} />
    <Button type="button" onClick={submit} disabled={loading} className="shrink-0"><Search className="mr-2 h-4 w-4" />{loading ? 'Mencari…' : 'Cari'}</Button>
    {(draft || value) && <Button type="button" variant="outline" aria-label={`Kosongkan ${label}`} title="Kosongkan carian" className="shrink-0" onClick={() => { setDraft(''); onValueChange?.(''); onSearch(''); }}><X className="h-4 w-4" /></Button>}
  </div>;
}
