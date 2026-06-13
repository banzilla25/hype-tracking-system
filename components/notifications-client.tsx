"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/actions/notifications";

type Notification = {
  notification_id: number;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  claim_id: number | null;
  poi_id: string | null;
};

const TYPE_CONFIG: Record<string, { color: string; dot: string }> = {
  nomor_invalid:     { color: "text-red-600",     dot: "bg-red-400" },
  disetujui_diklaim: { color: "text-teal-600",    dot: "bg-teal-400" },
  declined:          { color: "text-red-500",     dot: "bg-red-300" },
  campaign_jalan:    { color: "text-emerald-600", dot: "bg-emerald-400" },
  campaign_selesai:  { color: "text-gray-600",    dot: "bg-gray-400" },
  auto_release:        { color: "text-orange-600",  dot: "bg-orange-400" },
  new_poi_freelancer:  { color: "text-blue-600",    dot: "bg-blue-400" },
  approached_poi:      { color: "text-emerald-600", dot: "bg-emerald-400" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} mnt lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days < 30) return `${days} hari lalu`;
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function NotificationsClient({
  notifications,
}: {
  notifications: Notification[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkRead = (id: number) => {
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  };

  const handleMarkAll = () => {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-3 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Notifikasi</h1>
          {unreadCount > 0 && (
            <p className="text-xs text-gray-500">{unreadCount} belum dibaca</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={isPending}
            className="text-xs text-blue-600 font-medium disabled:opacity-40"
          >
            Tandai semua dibaca
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="p-10 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3 mx-auto">
            <BellIcon className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600">Tidak ada notifikasi</p>
          <p className="text-xs text-gray-400 mt-1">
            Kamu akan diberitahu saat ada update dari tim internal.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {notifications.map((notif) => {
            const cfg = TYPE_CONFIG[notif.type] ?? { color: "text-gray-700", dot: "bg-gray-400" };
            const linkHref = notif.claim_id ? `/tasks/${notif.claim_id}` : null;

            const card = (
              <div
                className={`flex items-start gap-3 px-6 py-4 transition-colors ${
                  notif.is_read ? "bg-white" : "bg-blue-50/40"
                }`}
                onClick={() => !notif.is_read && handleMarkRead(notif.notification_id)}
              >
                {/* Status dot */}
                <div className="mt-1 flex-shrink-0">
                  <div className={`w-2.5 h-2.5 rounded-full ${notif.is_read ? "bg-gray-200" : cfg.dot}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${notif.is_read ? "text-gray-600" : "text-gray-900 font-medium"}`}>
                    {notif.message}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">{timeAgo(notif.created_at)}</p>
                </div>

                {!notif.is_read && (
                  <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-blue-500" />
                )}
              </div>
            );

            return linkHref ? (
              <Link key={notif.notification_id} href={linkHref} className="block">
                {card}
              </Link>
            ) : (
              <div key={notif.notification_id}>{card}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}
