"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGetMySchool, type SchoolRecord } from "@/lib/api";
import { useUser } from "./user-context";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  escuela: "Escuela",
};

const ACTIONS_BY_ROLE: Record<
  string,
  Array<{ href: string; title: string; description: string }>
> = {
  admin: [
    {
      href: "/dashboard/pedidos",
      title: "Generar pedidos",
      description: "Previsualizar y confirmar el pedido semanal.",
    },
    {
      href: "/dashboard/menus",
      title: "Planificar menús",
      description: "Asignar recetas por opción, día y comida.",
    },
    {
      href: "/dashboard/asignaciones",
      title: "Actualizar precios",
      description: "Gestionar proveedor, localidad e ingrediente.",
    },
  ],
  gestor: [
    {
      href: "/dashboard/pedidos",
      title: "Generar pedidos",
      description: "Previsualizar y confirmar el pedido semanal.",
    },
    {
      href: "/dashboard/escuelas",
      title: "Revisar escuelas",
      description: "Consultar matrícula, localidad y comidas.",
    },
    {
      href: "/dashboard/ingredientes",
      title: "Consultar ingredientes",
      description: "Ver unidades y parámetros de cálculo.",
    },
  ],
  escuela: [
    {
      href: "/dashboard/mi-escuela",
      title: "Actualizar matrícula",
      description: "Mantener al día los datos propios.",
    },
    {
      href: "/dashboard/mi-escuela",
      title: "Cargar stock sobrante",
      description: "Informar cantidades para descontar del próximo pedido.",
    },
    {
      href: "/dashboard/pedidos",
      title: "Ver historial",
      description: "Descargar reportes de pedidos generados.",
    },
  ],
};

export default function DashboardPage() {
  const { user } = useUser();
  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [schoolError, setSchoolError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "escuela") return;

    apiGetMySchool()
      .then((data) => {
        setSchool(data);
        setSchoolError(null);
      })
      .catch((e: unknown) => {
        setSchool(null);
        setSchoolError(
          e instanceof Error ? e.message : "Error al cargar la escuela asociada",
        );
      });
  }, [user?.role]);

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando...</p>
        </div>
      </div>
    );
  }

  const actions = ACTIONS_BY_ROLE[user.role] ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
              Panel principal
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Bienvenido, {user.username}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Rol activo:{" "}
              <span className="font-semibold text-slate-800">
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm">
            <p className="font-semibold text-blue-900">{user.username}</p>
            <p className="text-blue-700">{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Accesos frecuentes
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {actions.map((action) => (
            <Link
              key={`${action.href}-${action.title}`}
              href={action.href}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
            >
              <p className="font-semibold text-slate-900">{action.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {user.role === "escuela" && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Escuela asociada
          </p>
          {school ? (
            <div className="mt-2">
              <p className="text-lg font-bold text-slate-950">
                {school.code} - {school.name}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {school.locality_name} · Matrícula:{" "}
                {school.matriculation.toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              {schoolError ?? "Cargando escuela..."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
