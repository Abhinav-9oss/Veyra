import { cn } from "@/utils/cn";

export function Avatar({
  src,
  name,
  size = 40,
  ring = false,
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const initials = (name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-violet-600/40 to-electric-600/30 flex items-center justify-center text-white font-semibold select-none",
        ring && "ring-2 ring-violet-500/40 shadow-glow",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {src ? (
        <img
          src={src}
          alt={name || "avatar"}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
