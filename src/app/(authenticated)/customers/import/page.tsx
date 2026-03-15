"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

type ImportResults = {
  total: number;
  success: number;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; kodKV: string; error: string }>;
};

export default function ImportCustomersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [results, setResults] = useState<ImportResults | null>(null);
  
  const router = useRouter();
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.xlsx')) {
      setFile(droppedFile);
      setResults(null);
    } else {
      toast({
        title: 'Invalid File',
        description: 'Sila muat naik fail Excel (.xlsx).',
        variant: 'destructive',
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResults(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/customers/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: 'Sesi Tamat',
            description: 'Sila login semula untuk teruskan import pelanggan.',
            variant: 'destructive',
          });
          router.push('/login');
          setIsUploading(false);
          return;
        }

        if (response.status === 403) {
          toast({
            title: 'Akses Ditolak',
            description: 'Hanya admin dibenarkan untuk import pelanggan.',
            variant: 'destructive',
          });
          setIsUploading(false);
          return;
        }

        toast({
          title: 'Import Gagal',
          description: data.error || 'Tidak dapat import pelanggan.',
          variant: 'destructive',
        });
        setIsUploading(false);
        return;
      }

      setResults(data.results);
      
      if (data.results.success > 0) {
        toast({
          title: 'Import Selesai',
          description: `${data.results.success} pelanggan diproses (${data.results.created} baru, ${data.results.updated} dikemaskini).`,
        });
      }
    } catch (error) {
      toast({
        title: 'Ralat Muat Naik',
        description: 'Tidak dapat memuat naik fail. Sila cuba lagi.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <PageHeader
        title="Import Pelanggan"
        description="Muat naik fail Excel untuk import data pelanggan secara pukal."
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link href="/customers">
              <ArrowLeft size={18} />
              Kembali ke Pelanggan
            </Link>
          </Button>
        }
      />

      <div className="space-y-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Format Fail Excel</CardTitle>
            <CardDescription>
              Fail Excel anda mesti mempunyai lajur berikut mengikut turutan:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2 text-sm">
              <Badge variant="outline" className="justify-center">A: Nama</Badge>
              <Badge variant="outline" className="justify-center">B: Alamat</Badge>
              <Badge variant="outline" className="justify-center">C: Postcode</Badge>
              <Badge variant="outline" className="justify-center">D: No. Telefon</Badge>
              <Badge variant="outline" className="justify-center">E: Kod KV</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Baris pertama ialah tajuk. Data bermula dari baris 2. Kod KV boleh berulang.
              Sistem juga menyokong kolum tambahan No/Bil di hadapan.
            </p>
            <Button
              asChild
              variant="outline"
              className="mt-4 gap-2"
              size="sm"
            >
              <a href="/api/customers/template" download>
                <Download size={16} />
                Muat Turun Templat
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Muat Naik Fail</CardTitle>
            <CardDescription>Seret dan lepas atau klik untuk pilih fail</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".xlsx"
                onChange={handleFileChange}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    {file ? (
                      <FileSpreadsheet className="h-8 w-8 text-primary" />
                    ) : (
                      <Upload className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  {file ? (
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">Seret & lepas fail Excel anda di sini</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        atau klik untuk pilih fail (.xlsx)
                      </p>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="gap-2 flex-1"
              >
                <Upload size={18} />
                {isUploading ? 'Mengimport...' : 'Import Pelanggan'}
              </Button>
              {file && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFile(null);
                    setResults(null);
                  }}
                >
                  Kosongkan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {results && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Keputusan Import</CardTitle>
              <CardDescription>Ringkasan proses import</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="border rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{results.total}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Jumlah Baris
                  </div>
                </div>
                <div className="border rounded-lg p-4 text-center border-green-500/30 bg-green-500/5">
                  <div className="text-2xl font-bold text-green-600">{results.success}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Berjaya
                  </div>
                </div>
                <div className="border rounded-lg p-4 text-center border-blue-500/30 bg-blue-500/5">
                  <div className="text-2xl font-bold text-blue-600">{results.created}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Rekod Baru
                  </div>
                </div>
                <div className="border rounded-lg p-4 text-center border-amber-500/30 bg-amber-500/5">
                  <div className="text-2xl font-bold text-amber-600">{results.updated}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Override
                  </div>
                </div>
                <div className="border rounded-lg p-4 text-center border-destructive/30 bg-destructive/5">
                  <div className="text-2xl font-bold text-destructive">{results.failed}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Gagal
                  </div>
                </div>
              </div>

              {results.success > 0 && (
                <Alert className="border-green-500/30 bg-green-500/5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>Import Berjaya</AlertTitle>
                  <AlertDescription>
                    {results.success} pelanggan diproses ({results.created} baru, {results.updated} dikemaskini).
                  </AlertDescription>
                </Alert>
              )}

              {results.failed > 0 && results.errors.length > 0 && (
                <div className="space-y-3">
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Ralat Import</AlertTitle>
                    <AlertDescription>
                      {results.failed} baris gagal diimport.
                    </AlertDescription>
                  </Alert>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-20">Row</TableHead>
                          <TableHead>Kod KV</TableHead>
                          <TableHead>Ralat</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.errors.slice(0, 10).map((error, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{error.row}</TableCell>
                            <TableCell className="font-mono text-xs">{error.kodKV}</TableCell>
                            <TableCell className="text-xs text-destructive">{error.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {results.errors.length > 10 && (
                      <div className="p-2 text-xs text-center text-muted-foreground bg-muted/30 border-t">
                        Memaparkan 10 daripada {results.errors.length} ralat
                      </div>
                    )}
                  </div>
                </div>
              )}

              {results.success > 0 && (
                <Button asChild className="w-full">
                  <Link href="/customers">Lihat Semua Pelanggan</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
