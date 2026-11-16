import { useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className={cn(
            "absolute left-1/2 -translate-x-1/2 z-40 px-2.5 py-1 rounded-lg text-xs whitespace-nowrap",
            "bg-ink-700 border border-white/10 text-gray-200 shadow-lg",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
