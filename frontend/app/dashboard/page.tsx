"use client";

import { useEffect, useState } from "react";
import { apiGetMySchool, type SchoolRecord } from "@/lib/api";
import { useUser } from "./user-context";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  escuela: "Escuela",
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
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">
          Bienvenido, {user.username}
        </h1>
        <p className="text-gray-500 mb-6">
          Rol:{" "}
          <span className="font-medium text-gray-700">
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-xl p-5">
            <p className="text-xs text-blue-500 uppercase tracking-wide font-medium mb-1">
              Usuario
            </p>
            <p className="text-lg font-semibold text-gray-800">{user.username}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">
              Rol
            </p>
            <p className="text-lg font-semibold text-gray-800">
              {ROLE_LABEL[user.role] ?? user.role}
            </p>
          </div>
        </div>

        {user.role === "escuela" && (
          <div className="mt-4 bg-green-50 rounded-xl p-5">
            <p className="text-xs text-green-600 uppercase tracking-wide font-medium mb-1">
              Escuela asociada
            </p>
            {school ? (
              <div>
                <p className="text-lg font-semibold text-gray-800">
                  {school.code} - {school.name}
                </p>
                <p className="text-sm text-gray-600">
                  {school.locality_name} - Matricula:{" "}
                  {school.matriculation.toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {schoolError ?? "Cargando escuela..."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
