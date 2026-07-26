import { motion } from "framer-motion";

export default function StatCard({ title, value, icon: Icon, tone = "blue", hint }) {
  const tones = {
    blue: "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-100",
    coral: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-100",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-100"
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-extrabold">{value ?? 0}</p>
          {hint && <p className="mt-1 text-xs font-medium text-slate-500">{hint}</p>}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
