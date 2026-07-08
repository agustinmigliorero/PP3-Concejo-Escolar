"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiLogin, tryRefresh } from "@/lib/api";
import { getAccessToken, setAccessToken as storeToken } from "@/lib/auth";
import { PasswordInput } from "@/components/password-input";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("/dashboard");

  useEffect(() => {
    const nextFrom =
      new URLSearchParams(window.location.search).get("from") || "/dashboard";
    setFrom(nextFrom);

    let active = true;
    async function redirectIfSessionIsValid() {
      if (getAccessToken() || (await tryRefresh())) {
        if (active) router.replace(nextFrom);
      }
    }

    redirectIfSessionIsValid();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiLogin(username, password);
      storeToken(data.access_token);
      router.push(from);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 text-[#172033] sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="hidden lg:block">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
            Backoffice
          </p>
          <h1 className="mt-3 max-w-xl text-4xl font-bold leading-tight text-slate-950">
            Consejo Escolar
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
            Gestión administrativa para escuelas, proveedores, recetas, menús y pedidos.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            {["Escuelas", "Pedidos", "Proveedores"].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 lg:hidden">
              Backoffice
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">
              Iniciar sesión
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Ingresá con tu usuario para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="username"
                className="text-sm font-semibold text-slate-700"
              >
                Usuario
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm transition focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100"
                placeholder="tu_usuario"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-semibold text-slate-700"
              >
                Contraseña
              </label>
              <PasswordInput
                id="password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                required
                placeholder="********"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-300"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
