"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type NotificationRecord,
  apiGetNotifications,
  apiGetUnreadCount,
  apiMarkNotificationRead,
} from "@/lib/api";

const POLL_INTERVAL = 30_000;

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin} min`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Hace ${diffHr}h`;

  return d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnread = async () => {
    try {
      const { count } = await apiGetUnreadCount();
      setUnread(count);
    } catch {
      // silent
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await apiGetNotifications();
      setNotifications(data);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchNotifications();
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const handleMarkRead = async (id: number) => {
    try {
      await apiMarkNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnread((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-lg border border-slate-300 bg-white p-2 text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        aria-label={`Notificaciones${unread > 0 ? ` (${unread} sin leer)` : ""}`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-800">Notificaciones</p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                No hay notificaciones
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.read) handleMarkRead(n.id);
                    if (n.escuela_id) router.push(`/dashboard/escuelas/${n.escuela_id}`);
                  }}
                  className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                    !n.read ? "bg-blue-50/40" : ""
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {!n.read ? (
                      <span className="block h-2 w-2 rounded-full bg-blue-500" />
                    ) : (
                      <span className="block h-2 w-2 rounded-full bg-transparent" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700">
                      {n.message}
                    </p>
                    {n.cargado_por_username && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        por {n.cargado_por_username}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatTime(n.created_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
