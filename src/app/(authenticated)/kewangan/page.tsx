import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export default async function KewanganPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/dashboard');
  return <iframe title="Kewangan Izotech" src="/api/kewangan/ui" className="w-full min-h-[calc(100vh-9rem)] rounded-lg border bg-white" />;
}
