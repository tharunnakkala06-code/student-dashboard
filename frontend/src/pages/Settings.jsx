import { Bell, ClipboardCheck, GraduationCap, Shield, Trophy } from "lucide-react";

const modules = [
  { title: "Attendance Module", icon: ClipboardCheck, status: "Placeholder ready", text: "Connect subject-wise attendance once the class timetable API is available." },
  { title: "Notifications", icon: Bell, status: "Placeholder ready", text: "Broadcast import alerts, profile edits, and ERP reminders to admins or students." },
  { title: "Student Ranking", icon: Trophy, status: "Placeholder ready", text: "Add marks or CGPA feeds later to generate ranked academic views." },
  { title: "Admin Security", icon: Shield, status: "Active", text: "JWT access, password hashing, and protected admin routes are enabled." }
];

export default function Settings() {
  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      <div>
        <p className="text-sm font-bold uppercase text-brand-600">Portal Controls</p>
        <h1 className="text-3xl font-extrabold">Settings</h1>
      </div>
      <section className="panel p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-100">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-extrabold">CSE C student Dashboard</h2>
            <p className="mt-1 text-sm text-slate-500">Modern university ERP style portal with Excel import, analytics, profiles, ID QR, exports, and role-based login.</p>
          </div>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {modules.map(({ title, icon: Icon, status, text }) => (
          <section key={title} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <Icon className="h-6 w-6 text-brand-600" />
              <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{status}</span>
            </div>
            <h2 className="mt-4 font-extrabold">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">{text}</p>
          </section>
        ))}
      </div>
      <p className="text-center text-xs font-semibold text-slate-500">Done by your "class respresentative" with love</p>
    </div>
  );
}
