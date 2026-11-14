'use client';
import { CustomerSearch, type CustomerMatch } from '@/components/customer-search';
export function KVAutocomplete({ value, onValueChange, onKVSelect, placeholder = 'Cari atau taip kod/nama KV', required = false }: {
  value: string; onValueChange: (value: string) => void; onKVSelect?: (customer: CustomerMatch) => void; placeholder?: string; required?: boolean;
}) {
  return <CustomerSearch value={value} onValueChange={onValueChange} onSelect={(customer) => onKVSelect?.(customer)} field="kodKV" placeholder={placeholder} required={required} />;
}
