'use client';
import { CustomerSearch, type CustomerMatch } from '@/components/customer-search';
export function CustomerAutocomplete({ value, onValueChange, onCustomerSelect, placeholder = 'Cari atau taip nama penerima', required = false }: {
  value: string; onValueChange: (value: string) => void; onCustomerSelect: (customer: CustomerMatch) => void; placeholder?: string; required?: boolean;
}) {
  return <CustomerSearch value={value} onValueChange={onValueChange} onSelect={onCustomerSelect} field="name" placeholder={placeholder} required={required} />;
}
