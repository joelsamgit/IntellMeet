import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/common/Sidebar";
import Header from "@/components/common/Header";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Welcome back! Here's what's happening.",
  },
  "/team": {
    title: "Team",
    subtitle: "Manage your team and workspaces.",
  },
  "/analytics": {
    title: "Analytics",
    subtitle: "Track your meeting productivity.",
  },
};

export default function MainLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const pageInfo = pageTitles[location.pathname] || {
    title: "IntellMeet",
    subtitle: "",
  };

  // Automatically close sidebar when changing page on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-[#0a0b0f] overflow-hidden">
      {/* Sidebar with mobile toggle props */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with hamburger menu trigger */}
        <Header 
          title={pageInfo.title} 
          subtitle={pageInfo.subtitle} 
          onMenuClick={() => setIsSidebarOpen(true)}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}