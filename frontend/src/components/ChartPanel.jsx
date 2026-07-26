export default function ChartPanel({ title, children, action }) {
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold">{title}</h2>
        {action}
      </div>
      <div className="h-72">{children}</div>
    </section>
  );
}
