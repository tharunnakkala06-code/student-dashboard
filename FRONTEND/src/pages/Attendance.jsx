import { useEffect, useMemo, useState } from "react";

import { supabase } from "../services/supabase";

function getSubjectCode(subject) {
  return subject.subject_code || subject.code || subject.subjectCode || "";
}

function getSubjectName(subject) {
  return subject.subject_name || subject.name || subject.subjectName || getSubjectCode(subject);
}

function getShortName(subject) {
  return subject.short_name || subject.shortName || getSubjectName(subject);
}

function getSubjectByCode(subjects, subjectCode) {
  return subjects.find((subject) => getSubjectCode(subject) === subjectCode);
}

function getAttendanceKey(date, hour) {
  return `${date}-hour-${hour}`;
}

function getInitialStatus(studentIndex, hour) {
  return (studentIndex + hour) % 5 === 0 ? "Absent" : "Present";
}

function getDaySchedule(subjects) {
  const subjectCodes = subjects.map(getSubjectCode).filter(Boolean);

  if (subjectCodes.length === 0) {
    return Array.from({ length: 8 }, () => "");
  }

  return Array.from({ length: 8 }, (_, index) => subjectCodes[index % subjectCodes.length]);
}

function Attendance() {
  const today = new Date().toISOString().slice(0, 10);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [selectedHour, setSelectedHour] = useState(1);
  const [hourAttendance, setHourAttendance] = useState({});
  const daySchedule = useMemo(() => getDaySchedule(subjects), [subjects]);
  const selectedSubject = getSubjectByCode(subjects, daySchedule[selectedHour - 1]);
  const attendanceKey = getAttendanceKey(attendanceDate, selectedHour);
  const subjectAttendanceSummary = useMemo(() => {
    return subjects.map((subject) => ({
      subjectCode: getSubjectCode(subject),
      subjectName: getSubjectName(subject),
      shortName: getShortName(subject),
      credits: subject.credits || "-",
      weeklyHours: subject.weekly_hours || subject.weeklyHours || "-",
      conductedHours: Number(subject.conducted_hours || subject.conductedHours || 0),
      attendedHours: Number(subject.attended_hours || subject.attendedHours || 0),
    }));
  }, [subjects]);
  const totalConductedHours = subjectAttendanceSummary.reduce(
    (total, subject) => total + subject.conductedHours,
    0,
  );
  const totalAttendedHours = subjectAttendanceSummary.reduce(
    (total, subject) => total + subject.attendedHours,
    0,
  );
  const overallAttendance = totalConductedHours > 0
    ? (totalAttendedHours / totalConductedHours) * 100
    : 0;

  useEffect(() => {
    async function fetchAttendanceData() {
      setLoading(true);
      setError("");

      try {
        const [studentsResult, subjectsResult] = await Promise.all([
          supabase.from("students").select("reg_no, student_name").order("reg_no", { ascending: true }),
          supabase.from("subjects").select("*"),
        ]);

        if (studentsResult.error || subjectsResult.error) {
          throw studentsResult.error || subjectsResult.error;
        }

        setStudents(studentsResult.data || []);
        setSubjects(subjectsResult.data || []);
      } catch (fetchError) {
        setError(fetchError.message || "Unable to load attendance data.");
      } finally {
        setLoading(false);
      }
    }

    fetchAttendanceData();
  }, []);

  const hourRecords = students.map((student, index) => {
    const studentId = student.reg_no;
    const savedStatus = hourAttendance[attendanceKey]?.[studentId];

    return {
      id: studentId,
      registrationNumber: student.reg_no,
      name: student.student_name,
      status: savedStatus || getInitialStatus(index, selectedHour),
    };
  });

  const presentCount = hourRecords.filter((record) => record.status === "Present").length;
  const absentCount = hourRecords.length - presentCount;

  function markAttendance(studentId, status) {
    setHourAttendance((currentAttendance) => ({
      ...currentAttendance,
      [attendanceKey]: {
        ...currentAttendance[attendanceKey],
        [studentId]: status,
      },
    }));
  }

  return (
    <div className="page-stack">
      <section className="section-heading">
        <div>
          <span className="eyebrow">CR Hour-wise Attendance</span>
          <h2>Attendance</h2>
        </div>
      </section>

      {error && <p className="status danger">{error}</p>}

      <section className="attendance-summary-grid">
        <article className="attendance-summary-card">
          <span>Overall Attendance</span>
          <strong>{overallAttendance.toFixed(2)}%</strong>
          <p>Formula: attended hours / conducted hours x 100</p>
        </article>
        <article className="attendance-summary-card">
          <span>Regular Subjects</span>
          <strong>{loading ? "..." : subjects.length}</strong>
          <p>Community Connect excluded</p>
        </article>
        <article className="attendance-summary-card success">
          <span>Attended Hours</span>
          <strong>{totalAttendedHours}</strong>
          <p>Total regular semester hours attended</p>
        </article>
        <article className="attendance-summary-card">
          <span>Conducted Hours</span>
          <strong>{totalConductedHours}</strong>
          <p>Total regular semester hours conducted</p>
        </article>
      </section>

      <section className="attendance-controls panel">
        <label>
          Date
          <input
            type="date"
            value={attendanceDate}
            onChange={(event) => {
              setAttendanceDate(event.target.value);
              setSelectedHour(1);
            }}
          />
        </label>
        <label>
          Current Semester Subjects
          <select defaultValue="All Subjects">
            <option>All Subjects</option>
            {subjects.map((subject) => (
              <option key={getSubjectCode(subject)}>
                {getSubjectCode(subject)} - {getSubjectName(subject)}
              </option>
            ))}
          </select>
        </label>
        <button className="save-attendance-button" type="button">
          Save Hour Attendance
        </button>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Class Schedule</h3>
          <span>{attendanceDate}</span>
        </div>
        <div className="hour-schedule-grid">
          {daySchedule.map((subjectCode, index) => {
            const hour = index + 1;
            const active = selectedHour === hour;
            const subject = getSubjectByCode(subjects, subjectCode);

            return (
              <button
                className={`hour-card${active ? " active" : ""}`}
                key={`${subjectCode || "hour"}-${hour}`}
                type="button"
                onClick={() => setSelectedHour(hour)}
              >
                <span>Hour {hour}</span>
                <strong>{subject ? getShortName(subject) : "-"}</strong>
                <small>{subjectCode || "No subject"}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="attendance-summary-grid">
        <article className="attendance-summary-card">
          <span>Selected Hour</span>
          <strong>Hour {selectedHour}</strong>
          <p>{selectedSubject ? `${getSubjectCode(selectedSubject)} - ${getSubjectName(selectedSubject)}` : "No subject selected"}</p>
        </article>
        <article className="attendance-summary-card success">
          <span>Present</span>
          <strong>{presentCount}</strong>
          <p>Marked for this hour</p>
        </article>
        <article className="attendance-summary-card danger">
          <span>Absent</span>
          <strong>{absentCount}</strong>
          <p>Marked for this hour</p>
        </article>
        <article className="attendance-summary-card">
          <span>Total Students</span>
          <strong>{loading ? "..." : hourRecords.length}</strong>
          <p>CR can update each hour separately</p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Hour-wise Marking</h3>
          <span>Hour {selectedHour} - {selectedSubject ? getSubjectCode(selectedSubject) : "No subject"}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Register No.</th>
                <th>Name</th>
                <th>Hour</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Mark</th>
              </tr>
            </thead>
            <tbody>
              {hourRecords.map((record) => (
                <tr key={record.id}>
                  <td>{record.registrationNumber}</td>
                  <td>{record.name}</td>
                  <td>Hour {selectedHour}</td>
                  <td>
                    <strong>{selectedSubject ? getShortName(selectedSubject) : "-"}</strong>
                    <span className="table-subtext">{selectedSubject ? getSubjectName(selectedSubject) : "No subject selected"}</span>
                  </td>
                  <td>
                    <span className={`status ${record.status === "Present" ? "success" : "danger"}`}>
                      {record.status}
                    </span>
                  </td>
                  <td>
                    <div className="segmented-actions">
                      <button
                        type="button"
                        className={record.status === "Present" ? "active" : ""}
                        onClick={() => markAttendance(record.id, "Present")}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        className={record.status === "Absent" ? "active danger" : ""}
                        onClick={() => markAttendance(record.id, "Absent")}
                      >
                        Absent
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && hourRecords.length === 0 && (
                <tr>
                  <td colSpan="6">No student records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Subject-wise Attendance Summary</h3>
          <span>Regular semester subjects only</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subject Code</th>
                <th>Subject Name</th>
                <th>Credits</th>
                <th>Weekly Hours</th>
                <th>Conducted Hours</th>
                <th>Attended Hours</th>
                <th>Attendance Percentage</th>
              </tr>
            </thead>
            <tbody>
              {subjectAttendanceSummary.map((summary) => {
                const percentage = summary.conductedHours > 0
                  ? (summary.attendedHours / summary.conductedHours) * 100
                  : 0;

                return (
                  <tr key={summary.subjectCode}>
                    <td>{summary.subjectCode}</td>
                    <td>
                      <strong>{summary.subjectName}</strong>
                      <span className="table-subtext">{summary.shortName}</span>
                    </td>
                    <td>{summary.credits}</td>
                    <td>{summary.weeklyHours}</td>
                    <td>{summary.conductedHours}</td>
                    <td>{summary.attendedHours}</td>
                    <td>
                      <span className={`status ${percentage < 75 ? "danger" : "success"}`}>
                        {percentage.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!loading && subjectAttendanceSummary.length === 0 && (
                <tr>
                  <td colSpan="7">No subject records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default Attendance;
