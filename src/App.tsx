import { useState } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ToastProvider } from "@/components/ui";
import { AuthPage } from "@/components/AuthPage";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/pages/HomePage";
import { MessagesPage } from "@/pages/MessagesPage";
import { CommunitiesPage } from "@/pages/CommunitiesPage";
import { DiscoverPage } from "@/pages/DiscoverPage";
import { AiStudioPage } from "@/pages/AiStudioPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { AdminPage } from "@/pages/AdminPage";
import { Loader } from "@/components/ui";
import type { Page } from "@/types/database";

function Shell() {
  const { session, loading } = useAuth();
  const [page, setPage] = useState<Page>("Home");

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center">
        <Loader label="Loading Veyra…" size={36} />
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  return (
    <Layout page={page} setPage={setPage}>
      {page === "Home" && <HomePage />}
      {page === "Messages" && <MessagesPage />}
      {page === "Communities" && <CommunitiesPage />}
      {page === "Discover" && <DiscoverPage />}
      {page === "AI Studio" && <AiStudioPage />}
      {page === "Profile" && <ProfilePage />}
      {page === "Admin" && <AdminPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AuthProvider>
  );
}
