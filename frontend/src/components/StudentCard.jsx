import { Building2, Phone, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

export default function StudentCard({ student }) {
  return (
    <Link to={`/students/${student.id}`} className="panel block p-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg dark:hover:border-brand-800">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-extrabold text-brand-700 dark:bg-slate-800 dark:text-brand-100">
          {(student.firstName?.[0] || "S") + (student.lastName?.[0] || "")}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-extrabold">{student.fullName || `${student.firstName} ${student.lastName}`}</h3>
          <p className="mt-1 text-xs font-bold uppercase text-brand-600">{student.registerNumber}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-xs text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-2"><UserRound className="h-4 w-4" />{student.gender || "Unspecified"}</span>
        <span className="flex items-center gap-2"><Phone className="h-4 w-4" />{student.phoneNumber || "No phone"}</span>
        <span className="flex items-center gap-2"><Building2 className="h-4 w-4" />{student.residencyType || "Unspecified"}</span>
      </div>
    </Link>
  );
}
