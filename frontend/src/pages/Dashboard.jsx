import { useEffect, useMemo, useState } from "react";

import { getCurrentUser, isStudent } from "../services/mockAuth";
import { supabase } from "../services/supabase";

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "No date";
}

function getAttendanceStatus(record) {
  return record.attendance_status || record.status || "Present";
}

function getAttendanceRegNo(record) {
  return record.reg_no || record.registration_number || record.register_number || "";
}

function getStudentRegNo(student) {
  return student.reg_no || student.registration_number || student.register_number || "";
}

function getStudentName(student) {
  return student.student_name || student.name || [student.first_name, student.last_name].filter(Boolean).join(" ") || getStudentRegNo(student);
}

function getAchievementRegNo(achievement) {
  return achievement.reg_no || achievement.registration_number || achievement.register_number || "";
}

function getAchievementDate(achievement) {
  return achievement.achievement_at || achievement.created_at;
}

function getNoticeDate(notice) {
  return notice.notice_date || notice.created_at;
}

function isMissingTable(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();

  return error?.code === "42P01" || message.includes("could not find the table") || message.includes("does not exist");
}

function getFriendlyError(error, fallback) {
  if (isMissingTable(error)) {
    return "A required database table is not configured.";
  }

  if (!navigator.onLine) {
    return "Network connection is unavailable. Please check your internet connection.";
  }

  return fallback;
}

function Dashboard() {
  const currentUser = getCurrentUser();
  const studentUser = isStudent(currentUser);
  const [stats, setStats] = useState({
    students: 0,
    achievements: 0,
    notices: 0,
    belowAttendance: 0,
  });
  const [achievements, setAchievements] = useState([]);
  const [notices, setNotices] = useState([]);
  const [attendanceWatchlist, setAttendanceWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const studentAchievements = useMemo(() => {
    return achievements.filter((achievement) => getAchievementRegNo(achievement) === currentUser.id);
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
          studentsResult,
          attendanceResult,
        ] = await Promise.all([
          supabase.from("students").select("*", { count: "exact", head: true }),
          supabase.from("Achievements Table").select("*", { count: "exact", head: true }),
          supabase.from("notice_table").select("*", { count: "exact", head: true }),
          supabase.from("Achievements Table").select("*").limit(5),
          supabase.from("notice_table").select("*").limit(5),
          supabase.from("students").select("*"),
          supabase.from("attendance").select("*"),
        ]);

        const fetchError = [
          studentsCountResult.error,
          achievementsCountResult.error,
          noticesCountResult.error,
          achievementsResult.error,
          noticesResult.error,
          studentsResult.error,
          attendanceResult.error && !isMissingTable(attendanceResult.error) ? attendanceResult.error : null,
        ].find(Boolean);

        if (fetchError) {
          throw fetchError;
        }

        const studentRows = studentsResult.data || [];
        const attendanceRows = attendanceResult.error ? [] : attendanceResult.data || [];
        const studentRegById = new Map(studentRows.map((student) => [String(student.id), getStudentRegNo(student)]));
        const attendanceByStudent = attendanceRows.reduce((studentMap, record) => {
          const regNo = getAttendanceRegNo(record) || studentRegById.get(String(record.student_id));

          if (!regNo) {
            return studentMap;
          }

          const summary = studentMap.get(regNo) || { conducted: 0, attended: 0 };
          summary.conducted += 1;
          summary.attended += getAttendanceStatus(record) === "Present" ? 1 : 0;
          studentMap.set(regNo, summary);

          return studentMap;
        }, new Map());
        const watchlist = studentRows
          .map((student) => {
            const regNo = getStudentRegNo(student);
            const summary = attendanceByStudent.get(regNo) || { conducted: 0, attended: 0 };
            const percentage = summary.conducted > 0 ? (summary.attended / summary.conducted) * 100 : 0;

            return {
              regNo,
              name: getStudentName(student),
              conducted: summary.conducted,
              attended: summary.attended,
              percentage,
            };
          })
          .filter((student) => student.conducted > 0 && student.percentage < 75)
          .sort((a, b) => a.percentage - b.percentage);

        setStats({
          students: studentsCountResult.count || 0,
          achievements: achievementsCountResult.count || 0,
          notices: noticesCountResult.count || 0,
          belowAttendance: watchlist.length,
        });
        setAchievements(achievementsResult.data || []);
        setNotices([...(noticesResult.data || [])].sort((a, b) => new Date(getNoticeDate(b)) - new Date(getNoticeDate(a))).slice(0, 5));
        setAttendanceWatchlist(watchlist);
      } catch (fetchError) {
        setError(getFriendlyError(fetchError, "Unable to load dashboard data."));
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
                    <tr key={`${getAchievementRegNo(achievement)}-${achievement.created_at}`}>
                      <td>{getAchievementRegNo(achievement)}</td>
                      <td>{formatDate(getAchievementDate(achievement))}</td>
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
                <div className="notice-item" key={`${notice.title}-${getNoticeDate(notice)}-${notice.target_audience}`}>
                  <strong>{notice.title}</strong>
                  <span>{formatDate(getNoticeDate(notice))}</span>
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
          <strong>{loading ? "..." : stats.belowAttendance}</strong>
          <p>Calculated from attendance records</p>
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
            <span>{loading ? "Loading" : `${attendanceWatchlist.length} students`}</span>
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
                {attendanceWatchlist.map((student) => (
                  <tr key={student.regNo}>
                    <td>{student.regNo}</td>
                    <td>{student.name}</td>
                    <td>
                      <span className="status danger">{student.percentage.toFixed(2)}%</span>
                    </td>
                  </tr>
                ))}
                {!loading && attendanceWatchlist.length === 0 && (
                  <tr>
                    <td colSpan="3">No attendance risks found.</td>
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
              <div className="notice-item" key={`${notice.title}-${getNoticeDate(notice)}-${notice.target_audience}`}>
                <strong>{notice.title}</strong>
                <span>{formatDate(getNoticeDate(notice))}</span>
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
