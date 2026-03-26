"use client";

import { useAuth } from '@/components/auth-context';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { LayoutDashboard, Users, UserPlus, UserCircle, LogOut, ShieldCheck, BookUser, ReceiptText, MapPinned, Package, ShoppingCart, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/components/ui/sidebar';

export function AppSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border/50 py-4">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7b2d3a] text-[#fff7f8] md:h-8 md:w-8 h-10 w-10">
            <ShieldCheck size={24} className="md:w-5 md:h-5 w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden md:text-xl text-2xl">
            KVar3.1
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="md:text-xs text-base">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/dashboard'} tooltip="Papan Pemuka" onClick={handleNavClick} className="text-lg md:text-base md:[&_svg]:w-5 md:[&_svg]:h-5 [&_svg]:w-6 [&_svg]:h-6">
                  <Link href="/dashboard">
                    <LayoutDashboard />
                    <span>Papan Pemuka</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/customers'} tooltip="Pelanggan" onClick={handleNavClick} className="text-lg md:text-base md:[&_svg]:w-5 md:[&_svg]:h-5 [&_svg]:w-6 [&_svg]:h-6">
                  <Link href="/customers">
                    <BookUser />
                    <span>Pelanggan</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/resit-1' || pathname === '/receipts'} tooltip="Resit" onClick={handleNavClick} className="text-lg md:text-base md:[&_svg]:w-5 md:[&_svg]:h-5 [&_svg]:w-6 [&_svg]:h-6">
                  <Link href="/resit-1">
                    <ReceiptText />
                    <span>Resit</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/tempahan'} tooltip="Tempahan" onClick={handleNavClick} className="text-lg md:text-base md:[&_svg]:w-5 md:[&_svg]:h-5 [&_svg]:w-6 [&_svg]:h-6">
                  <Link href="/tempahan">
                    <ShoppingCart />
                    <span>Tempahan</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/address-generator'} tooltip="Penjana Alamat" onClick={handleNavClick} className="text-lg md:text-base md:[&_svg]:w-5 md:[&_svg]:h-5 [&_svg]:w-6 [&_svg]:h-6">
                  <Link href="/address-generator">
                    <MapPinned />
                    <span>Penjana Alamat</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/data-parcel'} tooltip="Data Parcel" onClick={handleNavClick} className="text-lg md:text-base md:[&_svg]:w-5 md:[&_svg]:h-5 [&_svg]:w-6 [&_svg]:h-6">
                  <Link href="/data-parcel">
                    <Package />
                    <span>Data Parcel</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/rekod-jualan'} tooltip="Rekod Jualan" onClick={handleNavClick} className="text-lg md:text-base md:[&_svg]:w-5 md:[&_svg]:h-5 [&_svg]:w-6 [&_svg]:h-6">
                  <Link href="/rekod-jualan">
                    <BookOpen />
                    <span>Rekod Jualan</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {isAdmin && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/admin/users'} tooltip="Urus Pengguna" onClick={handleNavClick} className="text-lg md:text-base md:[&_svg]:w-5 md:[&_svg]:h-5 [&_svg]:w-6 [&_svg]:h-6">
                      <Link href="/admin/users">
                        <Users />
                        <span>Urus Pengguna</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/admin/users/create'} tooltip="Cipta Pengguna" onClick={handleNavClick} className="text-lg md:text-base md:[&_svg]:w-5 md:[&_svg]:h-5 [&_svg]:w-6 [&_svg]:h-6">
                      <Link href="/admin/users/create">
                        <UserPlus />
                        <span>Cipta Pengguna</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/profile'} tooltip="Profil Saya" onClick={handleNavClick} className="text-lg md:text-base md:[&_svg]:w-5 md:[&_svg]:h-5 [&_svg]:w-6 [&_svg]:h-6">
                  <Link href="/profile">
                    <UserCircle />
                    <span>Profil Saya</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50 p-4">
        <div className="flex flex-col gap-4 w-full">
          <div className="flex items-center gap-3 px-2 hidden md:flex">
            <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-semibold">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium leading-none text-sidebar-foreground truncate">{user.firstName} {user.lastName}</span>
              <span className="text-xs text-sidebar-foreground/60 truncate">{user.email}</span>
            </div>
          </div>
          <SidebarMenuButton onClick={logout} className="text-destructive hover:text-destructive hover:bg-destructive/10 md:text-sm text-base h-auto md:h-10 px-4 md:px-2">
            <LogOut className="md:w-4 md:h-4 w-6 h-6" />
            <span className="md:text-sm text-lg">Log Keluar</span>
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}