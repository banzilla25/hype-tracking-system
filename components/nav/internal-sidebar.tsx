"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { useTransition } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: ChartIcon },
  { href: "/leads", label: "Antrian Leads", icon: InboxIcon },
  { href: "/leads/add", label: "Sourcing F&B", icon: PlusCircleIcon },
  { href: "/approve", label: "Approve Akun", icon: CheckCircleIcon },
  { href: "/import", label: "Import POI", icon: UploadIcon },
  { href: "/notifications", label: "Notifikasi", icon: BellNavIcon },
];

export default function InternalSidebar({ nickname, unreadCount = 0 }: { nickname: string; unreadCount?: number }) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut();
    });
  };

  return (
    <aside className="w-16 md:w-56 min-h-screen bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all">
      {/* Header */}
      <div className="p-3 md:p-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">H</span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-bold text-gray-900">HYPE Tracking</p>
            <p className="text-xs text-gray-400">Internal</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-2 md:p-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const showBadge = item.href === "/notifications" && unreadCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center gap-3 px-2.5 md:px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <div className="relative shrink-0">
                <item.icon
                  className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-gray-400"}`}
                />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full md:hidden" />
                )}
              </div>
              <span className="hidden md:flex flex-1 items-center gap-1">{item.label}</span>
              {showBadge && (
                <span className="hidden md:flex min-w-4.5 h-4.5 bg-red-500 rounded-full items-center justify-center px-1.5">
                  <span className="text-[9px] text-white font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-2 md:p-3 border-t border-gray-100">
        <div className="hidden md:block px-3 py-2 mb-1">
          <p className="text-xs font-medium text-gray-700 truncate">{nickname}</p>
          <p className="text-xs text-gray-400">Internal</p>
        </div>
        <button
          onClick={handleSignOut}
          disabled={isPending}
          title="Logout"
          className="w-full flex items-center justify-center md:justify-start gap-3 px-2.5 md:px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          <LogoutIcon className="w-4 h-4 shrink-0" />
          <span className="hidden md:inline">{isPending ? "Keluar..." : "Logout"}</span>
        </button>
      </div>
    </aside>
  );
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
    </svg>
  );
}

function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function BellNavIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}
