"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiGetMe, apiLogout, tryRefresh, type UserInfo } from "@/lib/api";
import { getAccessToken, onAuthExpired } from "@/lib/auth";
import { ToastViewport } from "@/components/toast";
import { ManualModal } from "@/components/manual-modal";
import { NotificationBell } from "@/components/notification-bell";
import { UserContext } from "./user-context";

const ROLE_LABEL: Record<UserInfo["role"], string> = {
  admin: "Administrador",
  gestor: "Gestor",
  escuela: "Escuela",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    const redirectToLogin = () => {
      setUser(null);
      setAuthReady(false);
      router.replace(`/login?from=${encodeURIComponent(pathname || "/dashboard")}`);
    };
    const unsubscribe = onAuthExpired(redirectToLogin);
    let active = true;

    async function init() {
      setAuthReady(false);
      if (!getAccessToken()) {
        const ok = await tryRefresh();
        if (!ok) {
          if (active) redirectToLogin();
          return;
        }
      }
      try {
        const currentUser = await apiGetMe();
        if (!active) return;
        setUser(currentUser);
        setAuthReady(true);
      } catch {
        if (active) redirectToLogin();
      }
    }
    init();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [pathname, router]);

  async function handleLogout() {
    await apiLogout();
    setUser(null);
    setAuthReady(false);
    router.replace("/login");
  }

  const navLinks: Array<{ href: string; label: string; group: string }> = [
    { href: "/dashboard", label: "Inicio", group: "General" },
    ...(user?.role === "admin"
      ? [
          { href: "/dashboard/usuarios", label: "Usuarios", group: "Administración" },
          { href: "/dashboard/proveedores", label: "Proveedores", group: "Compras" },
          { href: "/dashboard/asignaciones", label: "Asignaciones", group: "Compras" },
          { href: "/dashboard/tipos-comida", label: "Tipos de comida", group: "Planificación" },
          { href: "/dashboard/recetas", label: "Recetas", group: "Planificación" },
          { href: "/dashboard/temporadas", label: "Temporadas", group: "Planificación" },
          { href: "/dashboard/menus", label: "Menús", group: "Planificación" },
        ]
      : []),
    ...(user?.role === "admin" || user?.role === "gestor"
      ? [
          { href: "/dashboard/localidades", label: "Localidades", group: "Catálogos" },
          { href: "/dashboard/ingredientes", label: "Ingredientes", group: "Catálogos" },
          { href: "/dashboard/escuelas", label: "Escuelas", group: "Escuelas" },
          { href: "/dashboard/pedidos", label: "Pedidos", group: "Operación" },
          { href: "/dashboard/reportes", label: "Reportes y estadísticas", group: "Operación" },
        ]
      : []),
    ...(user?.role === "escuela"
      ? [
          { href: "/dashboard/mi-escuela", label: "Mi escuela", group: "Escuela" },
          { href: "/dashboard/pedidos", label: "Pedidos", group: "Operación" },
        ]
      : []),
  ];

  const isLinkActive = (href: string) =>
    href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname?.startsWith(`${href}/`);
  const currentLink = navLinks.find((link) => isLinkActive(link.href));
  const navGroups = navLinks.reduce<Record<string, typeof navLinks>>((groups, link) => {
    groups[link.group] = [...(groups[link.group] ?? []), link];
    return groups;
  }, {});
  const isSessionReady = authReady && user !== null;

  return (
    <UserContext.Provider value={{ user }}>
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <div className="min-h-screen bg-[#f5f7fb] text-[#172033] lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:min-h-screen lg:flex-col">
          <div className="border-b border-slate-200 px-5 py-5">
            <Link href="/dashboard" className="block">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Backoffice
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                Consejo Escolar
              </p>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
            {Object.entries(navGroups).map(([group, links]) => (
              <div key={group} className="mb-5">
                <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  {group}
                </p>
                <div className="space-y-1">
                  {links.map((link) => {
                    const active = isLinkActive(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${
                          active
                            ? "bg-blue-50 text-blue-700 shadow-[inset_3px_0_0_var(--brand)]"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-slate-200 p-4">
            {user ? (
              <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {user.username}
                </p>
                <p className="text-xs text-slate-500">
                  {ROLE_LABEL[user.role] ?? user.role}
                </p>
              </div>
            ) : (
              <div className="mb-3 h-14 animate-pulse rounded-lg bg-slate-100" />
            )}
            <button
              onClick={handleLogout}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              Cerrar sesión
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 lg:hidden">
                  Consejo Escolar
                </p>
                <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                  {currentLink?.label ?? "Panel"}
                </h1>
              </div>
              <div className="flex items-center gap-3">
                {(user?.role === "admin" || user?.role === "gestor") && (
                  <NotificationBell />
                )}
                <button
                  type="button"
                  onClick={() => setManualOpen(true)}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  aria-haspopup="dialog"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M4 4.5A1.5 1.5 0 0 1 5.5 3H16v12.5H5.5A1.5 1.5 0 0 0 4 17V4.5Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 17a1.5 1.5 0 0 1 1.5-1.5H16"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="hidden sm:inline">Manual</span>
                </button>
                {user && (
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold text-slate-800">
                      {user.username}
                    </p>
                    <p className="text-xs text-slate-500">
                      {ROLE_LABEL[user.role] ?? user.role}
                    </p>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 lg:hidden"
                >
                  Salir
                </button>
              </div>
            </div>

            <nav
              className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden"
              aria-label="Navegación móvil"
            >
              {navLinks.map((link) => {
                const active = isLinkActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main id="contenido" className="backoffice-main flex-1 p-4 sm:p-6 lg:p-8">
            {isSessionReady ? (
              children
            ) : (
              <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                Cargando sesion...
              </div>
            )}
          </main>
        </div>
        <ToastViewport />
        {user && manualOpen && (
          <ManualModal role={user.role} onClose={() => setManualOpen(false)} />
        )}
      </div>
    </UserContext.Provider>
  );
}
