"use client";

// グローバルなトースト通知。ToastProvider をアプリ全体でラップし、
// useToast().toast(...) でどこからでも表示できる。

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";
interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const META: Record<ToastType, { icon: ReactNode; ring: string }> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    ring: "border-emerald-200 dark:border-emerald-500/30",
  },
  error: {
    icon: <AlertCircle className="h-5 w-5 text-rose-500" />,
    ring: "border-rose-200 dark:border-rose-500/30",
  },
  info: {
    icon: <Info className="h-5 w-5 text-cyan-500" />,
    ring: "border-cyan-200 dark:border-cyan-500/30",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = `t${counter.current++}`;
      setItems((prev) => [...prev, { id, message, type }]);
      setTimeout(() => remove(id), 3600);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* トースト表示領域（下部ナビと重ならないよう調整） */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-4 sm:top-auto sm:right-4 sm:bottom-4 sm:left-auto sm:items-end">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "card pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 border p-3.5 shadow-lg sm:animate-slide-in-right",
              META[t.type].ring
            )}
            role="status"
          >
            <span className="mt-0.5 shrink-0">{META[t.type].icon}</span>
            <p className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
              {t.message}
            </p>
            <button
              onClick={() => remove(t.id)}
              aria-label="閉じる"
              className="shrink-0 cursor-pointer rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
