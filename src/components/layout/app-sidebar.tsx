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

export function AppSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 py-4">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7b2d3a] text-[#fff7f8]">
            <ShieldCheck size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            KVar3.1
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/dashboard'} tooltip="Papan Pemuka">
                  <Link href="/dashboard">
                    <LayoutDashboard />
                    <span>Papan Pemuka</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/customers'} tooltip="Pelanggan">
                  <Link href="/customers">
                    <BookUser />
                    <span>Pelanggan</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/resit-1' || pathname === '/receipts'} tooltip="Resit">
                  <Link href="/resit-1">
                    <ReceiptText />
                    <span>Resit</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/tempahan'} tooltip="Tempahan">
                  <Link href="/tempahan">
                    <ShoppingCart />
                    <span>Tempahan</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/address-generator'} tooltip="Penjana Alamat">
                  <Link href="/address-generator">
                    <MapPinned />
                    <span>Penjana Alamat</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/data-parcel'} tooltip="Data Parcel">
                  <Link href="/data-parcel">
                    <Package />
                    <span>Data Parcel</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/rekod-jualan'} tooltip="Rekod Jualan">
                  <Link href="/rekod-jualan">
                    <BookOpen />
                    <span>Rekod Jualan</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {isAdmin && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/admin/users'} tooltip="Urus Pengguna">
                      <Link href="/admin/users">
                        <Users />
                        <span>Urus Pengguna</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/admin/users/create'} tooltip="Cipta Pengguna">
                      <Link href="/admin/users/create">
                        <UserPlus />
                        <span>Cipta Pengguna</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/profile'} tooltip="Profil Saya">
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 px-2 group-data-[collapsible=icon]:hidden">
            <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-semibold">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium leading-none text-sidebar-foreground truncate">{user.firstName} {user.lastName}</span>
              <span className="text-xs text-sidebar-foreground/60 truncate">{user.email}</span>
            </div>
          </div>
          <SidebarMenuButton onClick={logout} className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <LogOut />
            <span>Log Keluar</span>
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}