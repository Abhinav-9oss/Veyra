import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

export function Loader({
  label,
  className,
  size = 28,
}: {
  label?: string;
  className?: string;
  size?: number;
}) {
  return (
    <div className={cn("flex items-center justify-center gap-3 text-gray-400 py-8", className)}>
      <Loader2 className="animate-spin text-violet-400" style={{ width: size, height: size }} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
