"use client";

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Customer } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash2, UserPlus, Upload, Download } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

export default function CustomersPage() {
  const PAGE_SIZE = 10;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const searchParams = useSearchParams();

  const initialPage = (() => {
    const p = Number(searchParams.get('page') ?? '1');
    return Number.isFinite(p) && p > 0 ? Math.floor(p) : 1;
  })();
  const initialQ = searchParams.get('q') ?? '';
  const initialFilter = ((): 'all' | 'name' | 'postcode' | 'phone' | 'kodKV' => {
    const f = searchParams.get('filter');
    return f === 'name' || f === 'postcode' || f === 'phone' || f === 'kodKV' ? f : 'all';
  })();

  const [searchTerm, setSearchTerm] = useState(initialQ);
  const [filterBy, setFilterBy] = useState<'all' | 'name' | 'postcode' | 'phone' | 'kodKV'>(initialFilter);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageBeforeSearch, setPageBeforeSearch] = useState<number | null>(null);
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredCustomers = customers.filter((customer) => {
    if (!normalizedSearch) return true;

    if (filterBy === 'name') {
      return customer.name.toLowerCase().includes(normalizedSearch);
    }

    if (filterBy === 'postcode') {
      return customer.postcode.toLowerCase().includes(normalizedSearch);
    }

    if (filterBy === 'phone') {
      return customer.phone.toLowerCase().includes(normalizedSearch);
    }

    if (filterBy === 'kodKV') {
      return customer.kodKV.toLowerCase().includes(normalizedSearch);
    }

    return (
      customer.name.toLowerCase().includes(normalizedSearch) ||
      customer.address.toLowerCase().includes(normalizedSearch) ||
      customer.postcode.toLowerCase().includes(normalizedSearch) ||
      customer.phone.toLowerCase().includes(normalizedSearch) ||
      customer.kodKV.toLowerCase().includes(normalizedSearch)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginatedCustomers = filteredCustomers.slice(pageStart, pageStart + PAGE_SIZE);
  const pageCustomerIds = paginatedCustomers.map((customer) => customer.id);
  const allCurrentPageSelected =
    pageCustomerIds.length > 0 && pageCustomerIds.every((id) => selectedCustomerIds.includes(id));

  const replaceUrl = (page: number, q: string, filter: string) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (q.trim()) params.set('q', q);
    if (filter !== 'all') params.set('filter', filter);
    router.replace(`/customers?${params.toString()}`);
  };

  const loadCustomers = async () => {
    const response = await fetch('/api/customers', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setCustomers(data.customers ?? []);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSearchChange = (value: string) => {
    const hadSearch = searchTerm.trim().length > 0;
    const hasSearch = value.trim().length > 0;

    if (!hadSearch && hasSearch) {
      setPageBeforeSearch(currentPage);
      setCurrentPage(1);
      setSearchTerm(value);
      replaceUrl(1, value, filterBy);
      return;
    }

    if (hadSearch && !hasSearch) {
      const restoredPage = pageBeforeSearch ?? currentPage;
      setCurrentPage(restoredPage);
      setPageBeforeSearch(null);
      setSearchTerm(value);
      replaceUrl(restoredPage, value, filterBy);
      return;
    }

    setSearchTerm(value);
    replaceUrl(1, value, filterBy);
    setCurrentPage(1);
  };

  const handleFilterChange = (value: 'all' | 'name' | 'postcode' | 'phone' | 'kodKV') => {
    setFilterBy(value);
    setCurrentPage(1);
    replaceUrl(1, searchTerm, value);
  };

  const buildCustomersReturnQuery = () => {
    const params = new URLSearchParams();
    params.set('page', String(safePage));
    if (searchTerm.trim()) params.set('q', searchTerm);
    if (filterBy !== 'all') params.set('filter', filterBy);
    return params.toString();
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;

    const response = await fetch(`/api/customers/${customerToDelete}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      toast({
        title: 'Padam Gagal',
        description: 'Tidak dapat memadam pelanggan.',
        variant: 'destructive',
      });
      setCustomerToDelete(null);
      return;
    }

    await loadCustomers();
    toast({
      title: 'Pelanggan Dipadam',
      description: 'Pelanggan berjaya dipadam.',
    });
    setCustomerToDelete(null);
  };

  const handleToggleCustomer = (customerId: string, checked: boolean) => {
    setSelectedCustomerIds((prev) => {
      if (checked) {
        if (prev.includes(customerId)) return prev;
        return [...prev, customerId];
      }
      return prev.filter((id) => id !== customerId);
    });
  };

  const handleToggleSelectAllCurrentPage = (checked: boolean) => {
    setSelectedCustomerIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...pageCustomerIds]));
      }
      return prev.filter((id) => !pageCustomerIds.includes(id));
    });
  };

  const handleBulkDelete = async () => {
    if (selectedCustomerIds.length === 0) return;
    setIsBulkDeleting(true);

    const response = await fetch('/api/customers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedCustomerIds }),
    });

    if (!response.ok) {
      toast({
        title: 'Padam Pukal Gagal',
        description: 'Tidak dapat memadam pelanggan yang dipilih.',
        variant: 'destructive',
      });
      setIsBulkDeleting(false);
      return;
    }

    const data = await response.json().catch(() => ({ deletedCount: selectedCustomerIds.length }));
    await loadCustomers();
    setSelectedCustomerIds([]);
    setIsBulkDeleting(false);

    toast({
      title: 'Pelanggan Dipadam',
      description: `${data.deletedCount ?? 0} pelanggan berjaya dipadam.`,
    });
  };

  const handleExportCustomers = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/customers/export', { method: 'GET' });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast({
          title: 'Export Gagal',
          description: data.error ?? 'Tidak dapat export data pelanggan.',
          variant: 'destructive',
        });
        return;
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') ?? '';
      const matchedName = contentDisposition.match(/filename="?([^\"]+)"?/i)?.[1];
      const fileName = matchedName ?? `customers-export-${Date.now()}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Berjaya',
        description: 'Data pelanggan berjaya diexport ke fail Excel.',
      });
    } catch {
      toast({
        title: 'Export Gagal',
        description: 'Ralat rangkaian/pelayan semasa export data pelanggan.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Pengurusan Pelanggan"
        description="Lihat dan urus semua rekod pelanggan."
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={handleExportCustomers} disabled={isExporting || customers.length === 0}>
              <Download size={18} />
              {isExporting ? 'Exporting...' : 'Export Excel'}
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/customers/import">
                <Upload size={18} />
                Import Excel
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link href="/customers/create">
                <UserPlus size={18} />
                Tambah Pelanggan
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <Input
          placeholder="Cari pelanggan..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="md:max-w-sm"
        />
        <Select
          value={filterBy}
          onValueChange={(value: 'all' | 'name' | 'postcode' | 'phone' | 'kodKV') => handleFilterChange(value)}
        >
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Tapis ikut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Medan</SelectItem>
            <SelectItem value="name">Nama</SelectItem>
            <SelectItem value="postcode">Postcode</SelectItem>
            <SelectItem value="phone">Telefon</SelectItem>
            <SelectItem value="kodKV">Kod KV</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="destructive"
          disabled={selectedCustomerIds.length === 0 || isBulkDeleting}
          onClick={handleBulkDelete}
        >
          {isBulkDeleting ? 'Memadam...' : `Padam Ditanda (${selectedCustomerIds.length})`}
        </Button>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[44px]">
                <Checkbox
                  checked={allCurrentPageSelected}
                  onCheckedChange={(checked) => handleToggleSelectAllCurrentPage(checked === true)}
                  aria-label="Select all customers on current page"
                />
              </TableHead>
              <TableHead className="w-[60px]">No</TableHead>
              <TableHead className="w-[200px]">Nama</TableHead>
              <TableHead>Alamat</TableHead>
              <TableHead>Postcode</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Kod KV</TableHead>
              <TableHead>Dicipta</TableHead>
              <TableHead className="text-right">Tindakan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Tiada pelanggan dijumpai.
                </TableCell>
              </TableRow>
            ) : (
              paginatedCustomers.map((customer, index) => (
                <TableRow key={customer.id} className="hover:bg-accent/5">
                  <TableCell>
                    <Checkbox
                      checked={selectedCustomerIds.includes(customer.id)}
                      onCheckedChange={(checked) => handleToggleCustomer(customer.id, checked === true)}
                      aria-label={`Select customer ${customer.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-muted-foreground">
                    {pageStart + index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    {customer.name}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {customer.address}
                  </TableCell>
                  <TableCell>{customer.postcode}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs bg-secondary px-2 py-1 rounded">
                      {customer.kodKV}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Tindakan</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/customers/edit/${customer.id}?${buildCustomersReturnQuery()}`} className="cursor-pointer">
                            <Edit className="mr-2 h-4 w-4" /> Edit Pelanggan
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:bg-destructive/10 cursor-pointer"
                          onClick={() => setCustomerToDelete(customer.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Padam Pelanggan
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {filteredCustomers.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            Tiada pelanggan dijumpai.
          </div>
        ) : (
          paginatedCustomers.map((customer) => (
            <div key={customer.id} className="rounded-lg border bg-card p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={selectedCustomerIds.includes(customer.id)}
                  onCheckedChange={(checked) => handleToggleCustomer(customer.id, checked === true)}
                  aria-label={`Select customer ${customer.name}`}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold leading-tight text-foreground truncate">{customer.name}</h3>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{customer.address}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded bg-muted px-2 py-1 font-medium">
                      {customer.postcode}
                    </span>
                    <span className="truncate font-medium">{customer.phone}</span>
                    <span className="font-mono font-semibold bg-secondary px-2 py-1 rounded">
                        {customer.kodKV}
                    </span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Tindakan</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href={`/customers/edit/${customer.id}?${buildCustomersReturnQuery()}`} className="cursor-pointer">
                        <Edit className="mr-2 h-4 w-4" /> Edit Pelanggan
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:bg-destructive/10 cursor-pointer"
                      onClick={() => setCustomerToDelete(customer.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Padam Pelanggan
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Memaparkan {filteredCustomers.length === 0 ? 0 : pageStart + 1} - {Math.min(pageStart + PAGE_SIZE, filteredCustomers.length)} daripada {filteredCustomers.length}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const next = Math.max(1, safePage - 1);
              setCurrentPage(next);
              replaceUrl(next, searchTerm, filterBy);
            }}
            disabled={safePage === 1}
          >
            Sebelum
          </Button>
          <span className="text-sm text-muted-foreground">
            Halaman {safePage} / {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => {
              const next = Math.min(totalPages, safePage + 1);
              setCurrentPage(next);
              replaceUrl(next, searchTerm, filterBy);
            }}
            disabled={safePage === totalPages}
          >
            Seterusnya
          </Button>
        </div>
      </div>

      <AlertDialog open={!!customerToDelete} onOpenChange={() => setCustomerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anda pasti?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak boleh diundur. Rekod pelanggan akan dipadam secara kekal
              daripada pangkalan data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Padam Pelanggan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
