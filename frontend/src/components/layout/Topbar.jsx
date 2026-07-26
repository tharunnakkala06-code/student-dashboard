import { Menu, Moon, Search, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

export default function Topbar() {
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Menu className="h-5 w-5 text-slate-500 lg:hidden" />
        <button
          type="button"
          onClick={() => navigate("/students")}
          className="hidden min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-500 transition hover:border-brand-200 md:flex dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
        >
          <Search className="h-4 w-4" />
          Search by student name, phone, or register number
        </button>
        <button type="button" onClick={toggleTheme} className="icon-btn" title="Toggle dark mode">
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>
    </header>
  );
}
