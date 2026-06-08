import { useEffect, useMemo, useState } from "react";

import { getCurrentUser, isStudent } from "../services/mockAuth";
import { supabase } from "../services/supabase";

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "No date";
}

function Dashboard() {
  const currentUser = getCurrentUser();
  const studentUser = isStudent(currentUser);
  const [stats, setStats] = useState({
    students: 0,
    achievements: 0,
    notices: 0,
  });
  const [achievements, setAchievements] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const studentAchievements = useMemo(() => {
    return achievements.filter((achievement) => achievement.reg_no === currentUser.id);
  }, [achievements, currentUser.id]);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      setError("");

      try {
        const [
          studentsCountResult,
          achievementsCountResult,
          noticesCountResult,
          achievementsResult,
          noticesResult,
        ] = await Promise.all([
          supabase.from("students").select("*", { count: "exact", head: true }),
          supabase.from("Achievements Table").select("*", { count: "exact", head: true }),
          supabase.from("notice_table").select("*", { count: "exact", head: true }),
          supabase.from("Achievements Table").select("reg_no, achievement_at, created_at").order("created_at", { ascending: false }).limit(5),
          supabase.from("notice_table").select("title, description, notice_date, target_audience").order("notice_date", { ascending: false }).limit(5),
        ]);

        const fetchError = [
          studentsCountResult.error,
          achievementsCountResult.error,
          noticesCountResult.error,
          achievementsResult.error,
          noticesResult.error,
        ].find(Boolean);

        if (fetchError) {
          throw fetchError;
        }

        setStats({
          students: studentsCountResult.count || 0,
          achievements: achievementsCountResult.count || 0,
          notices: noticesCountResult.count || 0,
        });
        setAchievements(achievementsResult.data || []);
        setNotices(noticesResult.data || []);
      } catch (fetchError) {
        setError(fetchError.message || "Unable to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (studentUser) {
    return (
      <div className="page-stack">
        <section className="section-heading">
          <div>
            <span className="eyebrow">Overview</span>
            <h2>Student Dashboard</h2>
          </div>
          <span className="date-chip">Academic Year 2026 - 2027</span>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <span>My Uploaded Records</span>
            <strong>{loading ? "..." : studentAchievements.length}</strong>
            <p>Achievements and certifications</p>
          </article>
          <article className="stat-card">
            <span>Notices</span>
            <strong>{loading ? "..." : stats.notices}</strong>
            <p>Available announcements</p>
          </article>
        </section>

        {error && <p className="status danger">{error}</p>}

        <section className="content-grid two-column">
          <article className="panel">
            <div className="panel-header">
              <h3>My Recent Uploads</h3>
              <span>{studentAchievements.length} records</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Register No.</th>
                    <th>Achievement Date</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {studentAchievements.map((achievement) => (
                    <tr key={`${achievement.reg_no}-${achievement.created_at}`}>
                      <td>{achievement.reg_no}</td>
                      <td>{formatDate(achievement.achievement_at)}</td>
                      <td>{formatDate(achievement.created_at)}</td>
                    </tr>
                  ))}
                  {!loading && studentAchievements.length === 0 && (
                    <tr>
                      <td colSpan="3">No achievement records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <h3>Recent Notices</h3>
              <span>Latest</span>
            </div>
            <div className="notice-list compact">
              {notices.map((notice) => (
                <div className="notice-item" key={`${notice.title}-${notice.notice_date}-${notice.target_audience}`}>
                  <strong>{notice.title}</strong>
                  <span>{formatDate(notice.notice_date)}</span>
                  <p>{notice.description}</p>
                  <span>{notice.target_audience}</span>
                </div>
              ))}
              {!loading && notices.length === 0 && <p>No notices found.</p>}
            </div>
          </article>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="section-heading">
        <div>
          <span className="eyebrow">Overview</span>
          <h2>Class Performance Snapshot</h2>
        </div>
        <span className="date-chip">Academic Year 2026 - 2027</span>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Total Students</span>
          <strong>{loading ? "..." : stats.students}</strong>
          <p>Active CSE C records</p>
        </article>
        <article className="stat-card warning">
          <span>Students Below 75% Attendance</span>
          <strong>0</strong>
          <p>No attendance data available</p>
        </article>
        <article className="stat-card">
          <span>Total Achievements</span>
          <strong>{loading ? "..." : stats.achievements}</strong>
          <p>Certificates submitted</p>
        </article>
        <article className="stat-card">
          <span>Recent Notices</span>
          <strong>{loading ? "..." : stats.notices}</strong>
          <p>Published this term</p>
        </article>
      </section>

      {error && <p className="status danger">{error}</p>}

      <section className="content-grid two-column">
        <article className="panel">
          <div className="panel-header">
            <h3>Attendance Watchlist</h3>
            <span>No data</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Register No.</th>
                  <th>Name</th>
                  <th>Attendance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="3">No attendance data available</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>Recent Notices</h3>
            <span>Latest</span>
          </div>
          <div className="notice-list compact">
            {notices.map((notice) => (
              <div className="notice-item" key={`${notice.title}-${notice.notice_date}-${notice.target_audience}`}>
                <strong>{notice.title}</strong>
                <span>{formatDate(notice.notice_date)}</span>
                <p>{notice.description}</p>
                <span>{notice.target_audience}</span>
              </div>
            ))}
            {!loading && notices.length === 0 && <p>No notices found.</p>}
          </div>
        </article>
      </section>
    </div>
  );
}

export default Dashboard;
