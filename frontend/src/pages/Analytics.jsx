import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartPanel from "../components/ChartPanel";
import Skeleton from "../components/Skeleton";
import { supabase } from "../lib/api";

const COLORS = ["#2563eb", "#df6470", "#10b981", "#f59e0b", "#8b5cf6", "#14b8a6", "#64748b"];

function Donut({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="name" innerRadius={56} outerRadius={94} paddingAngle={4}>
          {data.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

function Bars({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" fill="#2563eb" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const { data: students, error } = await supabase.from("students").select("*");
        if (error) throw error;

        const totalStudents = students.length;
        const hostellers = students.filter((s) => s.hostel_status === "Hosteller").length;
        const dayScholars = students.filter((s) => s.hostel_status === "Dayscholar").length;

        // genderRatio
        const genderMap = {};
        students.forEach((s) => {
          const g = s.gender || "Unspecified";
          genderMap[g] = (genderMap[g] || 0) + 1;
        });
        const genderRatio = Object.entries(genderMap).map(([name, count]) => ({ name, count }));

        // stateDistribution
        const stateMap = {};
        students.forEach((s) => {
          const st = s.state || "Unspecified";
          stateMap[st] = (stateMap[st] || 0) + 1;
        });
        const stateDistribution = Object.entries(stateMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        // residencyDistribution
        const residencyDistribution = [
          { name: "Hosteller", count: hostellers },
          { name: "Day Scholar", count: dayScholars }
        ];

        // bloodGroupDistribution
        const bloodMap = {};
        students.forEach((s) => {
          const bg = s.blood_group || "Unspecified";
          bloodMap[bg] = (bloodMap[bg] || 0) + 1;
        });
        const bloodGroupDistribution = Object.entries(bloodMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        setData({
          genderRatio,
          residencyDistribution,
          stateDistribution,
          bloodGroupDistribution
        });
      } catch (error) {
        // Ignore
      }
    }
    fetchAnalytics();
  }, []);

  if (!data) return <div className="grid gap-5 xl:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-80" />)}</div>;

  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      <div>
        <p className="text-sm font-bold uppercase text-brand-600">Interactive Reports</p>
        <h1 className="text-3xl font-extrabold">Analytics</h1>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <ChartPanel title="Gender Ratio"><Donut data={data.genderRatio} /></ChartPanel>
        <ChartPanel title="Hosteller vs Day Scholar"><Donut data={data.residencyDistribution} /></ChartPanel>
        <ChartPanel title="State-wise Distribution"><Bars data={data.stateDistribution.slice(0, 10)} /></ChartPanel>
        <ChartPanel title="Blood Group Distribution"><Bars data={data.bloodGroupDistribution.slice(0, 10)} /></ChartPanel>
      </div>
    </div>
  );
}
