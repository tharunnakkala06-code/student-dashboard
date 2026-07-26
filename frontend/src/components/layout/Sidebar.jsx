import { BarChart3, Bell, LayoutDashboard, LogOut, Settings, UploadCloud, UsersRound } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, admin: true },
  { to: "/students", label: "Students", icon: UsersRound, admin: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3, admin: true },
  { to: "/upload", label: "Upload Excel", icon: UploadCloud, admin: true },
  { to: "/settings", label: "Settings", icon: Settings }
];

export default function Sidebar() {
  const { logout, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const visibleLinks = links.filter((link) => !link.admin || isAdmin);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur lg:inset-y-0 lg:left-0 lg:right-auto lg:w-72 lg:border-r lg:border-t-0 lg:px-5 lg:py-6 dark:border-slate-800 dark:bg-slate-950/95">
      <div className="hidden lg:block">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-600 text-lg font-extrabold text-white">C</div>
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">SRM ERP Portal</p>
            <h1 className="text-lg font-extrabold">CSE C student Dashboard</h1>
          </div>
        </div>
        <div className="mt-8 rounded-lg bg-slate-100 p-3 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase text-slate-500">Signed in</p>
          <p className="mt-1 truncate text-sm font-bold">{user?.name || user?.registerNumber}</p>
        </div>
      </div>

      <nav className="grid grid-cols-6 gap-1 lg:mt-8 lg:flex lg:flex-col lg:gap-2">
        {visibleLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            className={({ isActive }) =>
              `flex items-center justify-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition lg:justify-start ${
                isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
              }`
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="hidden lg:inline">{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          title="Notifications"
          className="flex items-center justify-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-900"
        >
          <Bell className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={handleLogout}
          title="Logout"
          className="flex items-center justify-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 lg:mt-auto lg:justify-start dark:hover:bg-rose-950/30"
        >
          <LogOut className="h-5 w-5" />
          <span className="hidden lg:inline">Logout</span>
        </button>
      </nav>
    </aside>
  );
}
