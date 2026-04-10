import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Briefcase, Users, Sparkles, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import UserDropdown from "./UserDropdown";
import expandedLogo from "../assets/expanded-logo.png";
import collapsedLogo from "../assets/collapsed-logo.png";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/jobs",      label: "Jobs",       icon: Briefcase },
  { path: "/candidates",label: "Candidates", icon: Users },
  { path: "/screening", label: "Screening",  icon: Sparkles },
];

export default function Layout() {
  const location  = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed]   = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        style={{ width: collapsed ? "5rem" : "16rem" }}
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col shrink-0
          bg-sidebar text-sidebar-foreground border-r border-sidebar-border
          transition-[width] duration-300 ease-in-out
          lg:relative lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo row */}
        <div className="relative flex items-center h-16 px-3 border-b border-sidebar-border shrink-0 overflow-hidden">
          <div className={`flex items-center transition-all duration-300 overflow-hidden ${collapsed ? "w-8 justify-center" : "flex-1"}`}>
            <img
              src={collapsed ? collapsedLogo : expandedLogo}
              alt="Umurava"
              className={`object-contain transition-all duration-300 ${collapsed ? "w-8 h-8 rounded-full" : "h-8 w-auto"}`}
            />
          </div>

          {/* Desktop toggle button */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-full bg-sidebar-accent/50 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>

          {/* Mobile close */}
          <button
            className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground ml-auto"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="px-2 py-4 flex-1 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path + "/"));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}
                  ${collapsed ? "justify-center" : ""}
                `}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {/* Label slides out smoothly */}
                <span
                  className="whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out"
                  style={{ maxWidth: collapsed ? "0px" : "12rem", opacity: collapsed ? 0 : 1 }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Main ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
