"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGetMe, apiLogout, tryRefresh, type UserInfo } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  escuela: "Escuela",
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      // If no access token in memory (e.g. page refresh), try to recover via cookie
      if (!getAccessToken()) {
        const ok = await tryRefresh();
        if (!ok) {
          router.replace("/login");
          return;
        }
      }
      try {
        const me = await apiGetMe();
        setUser(me);
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  async function handleLogout() {
    await apiLogout();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Panel principal</h1>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>

          {user && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-4">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
                  {user.username[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{user.username}</p>
                  <p className="text-sm text-blue-600">{ROLE_LABEL[user.role] ?? user.role}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Rol</p>
                  <p className="font-medium text-gray-800 mt-1">
                    {ROLE_LABEL[user.role] ?? user.role}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">ID</p>
                  <p className="font-medium text-gray-800 mt-1">{user.id}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
