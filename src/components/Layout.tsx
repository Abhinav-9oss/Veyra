import { useState, type ReactNode } from "react";
import {
  Home,
  MessageSquare,
  Users,
  Compass,
  Sparkles,
  UserCircle,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  Shield,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui";
import { cn } from "@/utils/cn";
import type { Page } from "@/types/database";

const NAV: { name: Page; icon: typeof Home; label: string }[] = [
  { name: "Home", icon: Home, label: "Home" },
  { name: "Messages", icon: MessageSquare, label: "Messages" },
  { name: "Communities", icon: Users, label: "Communities" },
  { name: "Discover", icon: Compass, label: "Discover" },
  { name: "AI Studio", icon: Sparkles, label: "AI Studio" },
  { name: "Profile", icon: UserCircle, label: "Profile" },
];

const ADMIN_NAV: { name: Page; icon: typeof Home; label: string } = {
  name: "Admin",
  icon: Shield,
  label: "Admin",
};

export function Layout({
  page,
  setPage,
  children,
}: {
  page: Page;
  setPage: (p: Page) => void;
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (p: Page) => {
    setPage(p);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-ink-900 text-white flex">
      {/* Ambient glow */}
      <div className="fixed inset-0 bg-hero-radial opacity-60 pointer-events-none" />
      <div className="fixed inset-0 bg-grid-faint bg-[size:44px_44px] opacity-30 pointer-events-none" />

      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-white/10 bg-ink-800/40 backdrop-blur-xl relative z-20">
        <SidebarContent page={page} go={go} profile={profile} onSignOut={signOut} />
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-ink-900/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-ink-800 border-r border-white/10 flex flex-col animate-fade-in">
            <SidebarContent
              page={page}
              go={go}
              profile={profile}
              onSignOut={signOut}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col relative z-10">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-8 h-16 border-b border-white/10 bg-ink-900/70 backdrop-blur-xl">
          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/5 text-gray-300"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="md:hidden font-display text-xl font-bold">
            Veyra<span className="text-violet-400">.</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-sm text-gray-500">
            <Search className="w-4 h-4" />
            <span>Search people, communities, posts…</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button className="relative p-2 rounded-lg hover:bg-white/5 text-gray-300" aria-label="Notifications">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-violet-500 rounded-full shadow-glow" />
            </button>
            <button
              onClick={() => go("Profile")}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              <Avatar src={profile?.avatar_url} name={profile?.display_name} size={30} />
              <span className="hidden sm:block text-sm text-gray-300 max-w-[120px] truncate">
                {profile?.display_name || "Profile"}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  page,
  go,
  profile,
  onSignOut,
  onClose,
}: {
  page: Page;
  go: (p: Page) => void;
  profile: { display_name: string; username: string; avatar_url: string | null; role?: string } | null;
  onSignOut: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-6 h-16 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-electric-600 flex items-center justify-center shadow-glow">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-xl font-bold">
            Veyra<span className="text-violet-400">.</span>
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1">
        {NAV.map(({ name, icon: Icon, label }) => {
          const active = page === name;
          return (
            <button
              key={name}
              onClick={() => go(name)}
              className={cn(
                "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-sm font-medium transition-all group",
                active
                  ? "bg-gradient-to-r from-violet-600/20 to-transparent text-white border border-violet-500/30 shadow-glow-soft"
                  : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-colors",
                  active ? "text-violet-400" : "text-gray-500 group-hover:text-gray-300"
                )}
              />
              {label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 shadow-glow" />}
            </button>
          );
        })}
        {profile?.role === "admin" && (
          <div className="pt-3 mt-3 border-t border-white/10">
            <p className="px-3.5 pb-1.5 text-[11px] uppercase tracking-wider text-gray-600 font-medium">
              Moderation
            </p>
            <button
              onClick={() => go(ADMIN_NAV.name)}
              className={cn(
                "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-sm font-medium transition-all group",
                page === ADMIN_NAV.name
                  ? "bg-gradient-to-r from-violet-600/20 to-transparent text-white border border-violet-500/30 shadow-glow-soft"
                  : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
              )}
            >
              <Shield
                className={cn(
                  "w-5 h-5 transition-colors",
                  page === ADMIN_NAV.name ? "text-violet-400" : "text-gray-500 group-hover:text-gray-300"
                )}
              />
              {ADMIN_NAV.label}
              {page === ADMIN_NAV.name && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 shadow-glow" />
              )}
            </button>
          </div>
        )}
      </nav>

      <div className="px-3 pb-4 border-t border-white/10 pt-4">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
          <Avatar src={profile?.avatar_url} name={profile?.display_name} size={36} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">
              {profile?.display_name || "New user"}
            </p>
            <p className="text-xs text-gray-500 truncate">@{profile?.username || "user"}</p>
          </div>
          <button
            onClick={onSignOut}
            className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
