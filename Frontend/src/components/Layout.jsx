import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Briefcase, Users, Sparkles, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import UserDropdown from "./UserDropdown";

// 🔹 Import logos from src/assets/
import expandedLogo from "../assets/expanded-logo.png";
import collapsedLogo from "../assets/collapsed-logo.png";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/jobs", label: "Jobs", icon: Briefcase },
  { path: "/candidates", label: "Candidates", icon: Users },
  { path: "/screening", label: "Screening", icon: Sparkles }
];

export default function Layout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = () => setCollapsed(!collapsed);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 bg-sidebar text-sidebar-foreground 
        transform transition-all duration-300 ease-in-out
        lg:relative lg:translate-x-0 flex flex-col
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        ${collapsed ? 'lg:w-20' : 'lg:w-64'}
      `}>
        
        {/* Logo Header */}
        <div className="flex items-center justify-between h-16 px-6 lg:px-3 border-b border-sidebar-border shrink-0">
          {/* Logo */}
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-start'}`}>
            <img
              src={collapsed ? collapsedLogo : expandedLogo}
              alt="Logo"
              className="h-8 object-contain"
            />
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-full bg-sidebar-accent/50 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all"
            onClick={toggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>

          {/* Mobile Close */}
          <button
            className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 flex-1 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path + "/"));

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}
                `}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className={`
                  whitespace-nowrap transition-all duration-300 overflow-hidden
                  ${collapsed ? 'w-0 opacity-0 lg:w-0' : 'w-auto opacity-100'}
                `}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-card flex items-center px-4 lg:px-8 shrink-0">
          <button
            className="lg:hidden mr-4 text-foreground/60 hover:text-foreground"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <UserDropdown />
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}