"use client";

import { useAuth } from '@/components/auth-context';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Skeleton } from '@/components/ui/skeleton';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 w-full max-w-sm px-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="print:hidden">
        <AppSidebar />
      </div>
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b bg-card/95 backdrop-blur-md px-4 transition-all duration-300 ease-in-out print:hidden">
          <SidebarTrigger />
          <div className="ml-auto flex items-center gap-4">
            <div className="text-sm font-medium text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8 print:overflow-visible print:p-0">
          <div className="mx-auto max-w-6xl w-full print:max-w-none">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
