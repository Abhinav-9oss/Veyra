import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/utils/cn";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; type: ToastType; message: string };

const ToastContext = createContext<{
  push: (type: ToastType, message: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 w-[min(360px,calc(100vw-2.5rem))]">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "glass-strong rounded-xl px-4 py-3 flex items-center gap-3 animate-fade-in shadow-lg",
              t.type === "success" && "border-emerald-500/30",
              t.type === "error" && "border-red-500/30",
              t.type === "info" && "border-violet-500/30"
            )}
          >
            {t.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {t.type === "error" && <AlertCircle className="w-5 h-5 text-red-400" />}
            {t.type === "info" && <Info className="w-5 h-5 text-violet-400" />}
            <span className="text-sm text-gray-100 flex-1">{t.message}</span>
            <button
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// Re-export so the barrel works for callers expecting a component
export const Toast = ToastProvider;
