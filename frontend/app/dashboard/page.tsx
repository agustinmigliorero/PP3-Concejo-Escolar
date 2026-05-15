"use client";

import { useUser } from "./user-context";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  escuela: "Escuela",
};

export default function DashboardPage() {
  const { user } = useUser();

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
      </div>
    </div>
  );
}
