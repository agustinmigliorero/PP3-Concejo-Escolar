"use client";

import { useEffect, useState } from "react";

type ToastVariant = "success" | "error";

interface ToastPayload {
  message: string;
  variant?: ToastVariant;
}

interface ToastItem extends Required<ToastPayload> {
  id: number;
}

const TOAST_EVENT = "app:toast";

export function showToast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastPayload>(TOAST_EVENT, {
      detail: payload,
    }),
  );
}

export function showSuccessToast(message: string) {
  showToast({ message, variant: "success" });
}

export function showErrorToast(message: string) {
  showToast({ message, variant: "error" });
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handleToast(event: Event) {
      const { message, variant = "success" } = (event as CustomEvent<ToastPayload>).detail;
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, message, variant }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4200);
    }

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[70] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`relative overflow-hidden rounded-lg border bg-white px-4 py-3 pr-10 text-sm font-medium shadow-lg ${
            toast.variant === "success"
              ? "border-green-200 text-green-800"
              : "border-red-200 text-red-800"
          }`}
          role={toast.variant === "error" ? "alert" : "status"}
        >
          <span
            className={`absolute left-0 top-0 h-full w-1 ${
              toast.variant === "success" ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span
            className={`absolute right-4 top-3 h-2 w-2 rounded-full ${
              toast.variant === "success" ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <p className="leading-5">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}
