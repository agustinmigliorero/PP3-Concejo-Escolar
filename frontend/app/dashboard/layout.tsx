"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiGetMe, apiLogout, tryRefresh, type UserInfo } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { UserContext } from "./user-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    async function init() {
      if (!getAccessToken()) {
        const ok = await tryRefresh();
        if (!ok) {
          router.replace("/login");
          return;
        }
      }
      try {
        setUser(await apiGetMe());
      } catch {
        router.replace("/login");
      }
    }
    init();
  }, [router]);

  async function handleLogout() {
    await apiLogout();
    router.replace("/login");
  }

  const navLinks = [
    { href: "/dashboard", label: "Inicio" },
    ...(user?.role === "admin"
      ? [{ href: "/dashboard/usuarios", label: "Usuarios" }]
      : []),
    ...(user?.role === "admin" || user?.role === "gestor"
      ? [{ href: "/dashboard/localidades", label: "Localidades" }]
      : []),
  ];

  return (
    <UserContext.Provider value={{ user }}>
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-gray-800 text-lg">
              Consejo Escolar
            </span>
            <nav className="flex gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === l.href
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-gray-500">{user.username}</span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </UserContext.Provider>
  );
}
