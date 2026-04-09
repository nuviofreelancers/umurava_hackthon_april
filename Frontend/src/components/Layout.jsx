import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Briefcase, Users, Sparkles, LogOut, Menu, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";

// Make sure to place your logo images in src/assets/ and update the paths if necessary
import expandedLogo from "@/assets/expanded-logo.png"; 
import collapsedLogo from "@/assets/collapsed-logo.png";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/jobs", label: "Jobs", icon: Briefcase },
  { path: "/candidates", label: "Candidates", icon: Users },
  { path: "/screening", label: "Screening", icon: Sparkles },
];

export default function Layout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Default to expanded (true) on desktop
  const [isExpanded, setIsExpanded] = useState(true);
  const { logout, user } = useAuth();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className={
        `fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 flex flex-col 
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isExpanded ? 'w-64' : 'w-20'}
      `}>
        {/* Header Section */}
        <div className="flex items-center h-16 border-b border-border px-4 justify-between">
          <div className={`flex items-center ${isExpanded ? 'gap-3' : 'justify-center w-full'}`}>
            {isExpanded ? (
              // Expanded Logo: Spans full width (Right/Left), Fixed height (No Top/Bottom stretch)
              <img 
                src={expandedLogo} 
                alt="Umurava Logo" 
                className="w-full h-8 object-contain" 
              />
            ) : (
              // Collapsed Logo: Small square icon
              <img 
                src={collapsedLogo} 
                alt="Umurava Icon" 
                className="w-8 h-8 object-contain rounded-full" 
              />
            )}
          </div>

          {/* Collapse Button (Visible when expanded) */}
          {isExpanded && (
            <button 
              onClick={() => setIsExpanded(false)}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hidden lg:flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Expand Button (Visible when collapsed, floats to the right) */}
        {!isExpanded && (
          <button 
            onClick={() => setIsExpanded(true)}
            className="absolute top-5 -right-3 z-50 p-1 rounded-full bg-white border border-border shadow-md hover:bg-accent text-muted-foreground hidden lg:flex items-center justify-center transition-all hover:scale-110"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'}
                  ${!isExpanded ? 'justify-center' : ''}
                `}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className={`whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer / Sign Out */}
        <div className="p-3 border-t border-border">
          <button
            onClick={logout}
            className={`
              flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors
              ${!isExpanded ? 'justify-center' : ''}
            `}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className={`whitespace-nowrap transition-opacity duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center px-4 lg:px-8 shrink-0">
          <button className="lg:hidden mr-4 text-foreground/60" onClick={() => setMobileOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}