import { ArrowUpDown, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function StudentTable({ students, onSort, onDelete }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
            <tr>
              {[
                ["Name", "firstName"],
                ["Register Number", "registerNumber"],
                ["Gender", "gender"],
                ["Phone", "phoneNumber"],
                ["Residency", "residencyType"],
                ["State", "stateName"]
              ].map(([label, key]) => (
                <th key={key} className="px-4 py-3 font-bold">
                  <button type="button" onClick={() => onSort(key)} className="inline-flex items-center gap-1">
                    {label}
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/80">
                <td className="px-4 py-3 font-semibold">
                  <Link to={`/students/${student.id}`} className="text-brand-700 hover:underline dark:text-brand-100">
                    {student.fullName || `${student.firstName} ${student.lastName}`}
                  </Link>
                </td>
                <td className="px-4 py-3 font-bold uppercase">{student.registerNumber}</td>
                <td className="px-4 py-3">{student.gender || "-"}</td>
                <td className="px-4 py-3">{student.phoneNumber || "-"}</td>
                <td className="px-4 py-3">{student.residencyType || "-"}</td>
                <td className="px-4 py-3">{student.stateName || "-"}</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => onDelete(student)} className="icon-btn h-9 w-9 text-rose-600" title="Delete student">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
