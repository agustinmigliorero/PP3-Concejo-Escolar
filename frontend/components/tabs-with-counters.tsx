"use client";

export interface TabDef {
  key: string;
  label: string;
  count: number;
}

/**
 * Barra de pestañas subrayadas con insignias de contador por pestaña,
 * coincidente con las páginas CRUD.
 */
export function TabsWithCounters({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 mb-4 border-b border-gray-200">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              isActive
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            <span
              className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                isActive
                  ? "bg-blue-100 text-blue-600"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
