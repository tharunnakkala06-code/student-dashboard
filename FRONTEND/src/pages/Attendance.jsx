import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

// ─── Constants ───────────────────────────────────────────────────────────────
const HOUR_COUNT = 8;
const NON_ATTENDANCE_PERIODS = new Set(["BREAK", "FREE"]);
const WEEKEND_DAYS = new Set(["Saturday", "Sunday"]);

// ─── Helper utilities ────────────────────────────────────────────────────────
function getValue(record, keys, fallback = "") {
  for (const key of keys) {
    if (record?.[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return fallback;
}

function getSubjectCode(subject) {
  return getValue(subject, ["subject_code", "code", "subjectCode"]);
}

function getSubjectName(subject) {
  return getValue(subject, ["subject_name", "name", "description", "subjectName"], getSubjectCode(subject));
}

function getShortName(subject) {
  return getValue(subject, ["short_name", "shortName"], getSubjectName(subject));
}

function getStudentRegNo(student) {
  return getValue(student, ["reg_no", "registration_number", "register_number", "registerNumber"]);
}

function getStudentName(student) {
  const fullName = [student?.first_name, student?.last_name].filter(Boolean).join(" ");
  return getValue(student, ["student_name", "name", "first_name", "firstName"], fullName || getStudentRegNo(student));
}

function getAttendanceStatus(record) {
  return getValue(record, ["attendance_status", "status"], "Present");
}

function getAttendanceHour(record) {
  return Number(getValue(record, ["hour", "period"], 0));
}

function getAttendanceSubjectCode(record) {
  return getValue(record, ["subject_code", "code"]);
}

function getFriendlyError(error, fallback) {
  if (!navigator.onLine) {
    return "Network connection is unavailable. Please check your internet connection.";
  }
  return fallback;
}

function getDayName(dateValue) {
  if (!dateValue) return "";
  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });
}

function getTimetableDay(row) {
  return getValue(row, ["day", "day_of_week", "dayOfWeek", "weekday"]);
}

function isSelectedTimetableDay(row, dayName) {
  return getTimetableDay(row).trim().toLowerCase() === dayName.trim().toLowerCase();
}

function getTimetableHour(row) {
  return Number(getValue(row, ["hour", "period"], 0));
}

// ─── Schedule builder ────────────────────────────────────────────────────────
// Returns ONLY teaching periods (BREAK/FREE excluded).
// Each period has:
//   hour        – original DB column value  → used for all Supabase queries & saves
//   displayHour – sequential UI number (1, 2, 3 …) → shown on cards, never saved
function buildSchedule(timetableRows, subjects, dayName) {
  if (WEEKEND_DAYS.has(dayName)) {
    return Array.from({ length: HOUR_COUNT }, (_, i) => ({
      hour: i + 1,
      displayHour: i + 1,
      subjectCode: "",
      subjectName: "No classes scheduled.",
      shortName: "No classes scheduled.",
      disabled: true,
      type: "WEEKEND",
    }));
  }

  const subjectByCode = new Map(subjects.map((s) => [getSubjectCode(s), s]));

  // All rows for this day, sorted by original DB hour
  const dayRows = timetableRows
    .filter((row) => isSelectedTimetableDay(row, dayName))
    .sort((a, b) => getTimetableHour(a) - getTimetableHour(b));

  // Keep only actual teaching periods — discard BREAK and FREE entirely
  const teachingRows = dayRows.filter((row) => {
    const code = (getValue(row, ["subject_code", "subjectCode", "code"]) || "").trim().toUpperCase();
    const name = (getValue(row, ["subject_name", "subjectName", "name"]) || "").trim().toUpperCase();
    return !NON_ATTENDANCE_PERIODS.has(code) && !NON_ATTENDANCE_PERIODS.has(name);
  });

  // Assign sequential displayHour while preserving original DB hour
  return teachingRows.map((row, index) => {
    const dbHour = getTimetableHour(row);   // DB value — used in Supabase ops
    const displayHour = index + 1;           // UI label — display only
    const subjectCode = getValue(row, ["subject_code", "subjectCode", "code"]);
    const linkedSubject = subjectCode ? subjectByCode.get(subjectCode) : null;
    const subjectName = getValue(row, ["subject_name", "subjectName", "name"], getSubjectName(linkedSubject));

    return {
      hour: dbHour,
      displayHour,
      subjectCode,
      subjectName,
      shortName: getValue(row, ["short_name", "shortName"], subjectName || subjectCode),
      disabled: false,
      type: "TEACHING",
    };
  });
}

// ─── Attendance summary builder ───────────────────────────────────────────────
function summarizeAttendance(subjects, attendanceRecords) {
  return subjects.map((subject) => {
    const subjectCode = getSubjectCode(subject);
    const subjectRecords = attendanceRecords.filter(
      (r) => getAttendanceSubjectCode(r) === subjectCode
    );
    const conductedHours = new Set(
      subjectRecords.map((r) => `${r.attendance_date}-${getAttendanceHour(r)}`)
    ).size;
    const attendedHours = subjectRecords.filter(
      (r) => getAttendanceStatus(r) === "Present"
    ).length;
    return {
      subjectCode,
      subjectName: getSubjectName(subject),
      shortName: getShortName(subject),
      credits: subject.credits || "-",
      weeklyHours: subject.weekly_hours || subject.weeklyHours || "-",
      conductedHours,
      attendedHours,
    };
  });
}

// ─── Main component ───────────────────────────────────────────────────────────
function Attendance() {
  const today = new Date().toISOString().slice(0, 10);

  // ── State ────────────────────────────────────────────────────────────────
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [timetableRows, setTimetableRows] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [selectedHour, setSelectedHour] = useState(1);         // DB hour — used for Supabase
  const [selectedDisplayHour, setSelectedDisplayHour] = useState(1); // UI label — display only
  const [hourAttendance, setHourAttendance] = useState({});    // regNo → "Present" | "Absent"
  const [subjectFilter, setSubjectFilter] = useState("All Subjects");

  // ── Derived values ────────────────────────────────────────────────────────
  const dayName = useMemo(() => getDayName(attendanceDate), [attendanceDate]);

  const daySchedule = useMemo(
    () => buildSchedule(timetableRows, subjects, dayName),
    [timetableRows, subjects, dayName]
  );

  // Find selected period by DB hour (not array index — the schedule is now variable-length)
  const selectedPeriod = useMemo(
    () => daySchedule.find((p) => p.hour === selectedHour) || null,
    [daySchedule, selectedHour]
  );
  const selectedSubject = selectedPeriod && !selectedPeriod.disabled ? selectedPeriod : null;

  const filteredAttendanceRecords = useMemo(() => {
    if (subjectFilter === "All Subjects") return attendanceRecords;
    return attendanceRecords.filter((r) => getAttendanceSubjectCode(r) === subjectFilter);
  }, [attendanceRecords, subjectFilter]);

  const subjectAttendanceSummary = useMemo(
    () =>
      summarizeAttendance(
        subjectFilter === "All Subjects"
          ? subjects
          : subjects.filter((s) => getSubjectCode(s) === subjectFilter),
        attendanceRecords
      ),
    [subjects, attendanceRecords, subjectFilter]
  );

  const totalConductedHours = useMemo(
    () => subjectAttendanceSummary.reduce((t, s) => t + s.conductedHours, 0),
    [subjectAttendanceSummary]
  );

  const totalAttendedHours = useMemo(
    () => filteredAttendanceRecords.filter((r) => getAttendanceStatus(r) === "Present").length,
    [filteredAttendanceRecords]
  );

  const overallAttendance =
    filteredAttendanceRecords.length > 0
      ? (totalAttendedHours / filteredAttendanceRecords.length) * 100
      : 0;

  // hourRecords: one entry per student with their current toggled status
  // useMemo ensures this only recomputes when students or hourAttendance actually change,
  // preventing stale renders that could silently reset marks.
  const hourRecords = useMemo(
    () =>
      students.map((student) => {
        const studentId = getStudentRegNo(student); // reads student.reg_no
        return {
          id: studentId,
          registrationNumber: studentId,
          name: getStudentName(student),
          status: hourAttendance[studentId] ?? "Present",
        };
      }),
    [students, hourAttendance]
  );

  const presentCount = useMemo(
    () => hourRecords.filter((r) => r.status === "Present").length,
    [hourRecords]
  );
  const absentCount = hourRecords.length - presentCount;

  // ── Effects ───────────────────────────────────────────────────────────────

  // Load subjects on startup (fast, blocks page spinner briefly)
  useEffect(() => {
    async function fetchSubjects() {
      setLoading(true);
      setError("");
      try {
        const { data, error: err } = await supabase.from("subjects").select("*");
        if (err) throw err;
        setSubjects(data || []);
      } catch (e) {
        setError(getFriendlyError(e, "Unable to load subject data."));
      } finally {
        setLoading(false);
      }
    }
    fetchSubjects();
  }, []);

  // Load attendance records in the background for stats (non-blocking)
  useEffect(() => {
    async function fetchAttendanceStats() {
      const { data, error: err } = await supabase
        .from("attendance")
        .select("attendance_date, day, hour, register_number, subject_code, status");
      if (!err && data) setAttendanceRecords(data);
    }
    fetchAttendanceStats();
  }, []);

  // Load timetable whenever the selected day changes
  useEffect(() => {
    async function fetchTimetableForDay() {
      setTimetableRows([]);
      if (WEEKEND_DAYS.has(dayName)) return;

      setTimetableLoading(true);
      setError("");
      try {
        const { data, error: err } = await supabase
          .from("timetable")
          .select("*")
          .order("hour", { ascending: true });
        if (err) throw err;
        setTimetableRows(data || []);
      } catch (e) {
        setError(getFriendlyError(e, "Unable to load timetable."));
      } finally {
        setTimetableLoading(false);
      }
    }
    fetchTimetableForDay();
  }, [dayName]);

  // When the DATE changes → clear all student data (new day = fresh start)
  // NOTE: This must NOT depend on daySchedule, because daySchedule gets a new
  // array reference on every useMemo recompute, which would wipe marks mid-session.
  useEffect(() => {
    setStudents([]);
    setHourAttendance({});
    setMessage("");
  }, [attendanceDate]);

  // When the SCHEDULE changes → auto-select the first teaching period.
  // Does NOT clear students or hourAttendance so marks survive background re-renders.
  useEffect(() => {
    const firstPeriod = daySchedule.find((p) => !p.disabled);
    setSelectedHour(firstPeriod?.hour || 1);
    setSelectedDisplayHour(firstPeriod?.displayHour || 1);
  }, [daySchedule]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function fetchStudentsForHour(period = selectedSubject) {
    if (!period) return;

    setStudentsLoading(true);
    setError("");
    setMessage("");
    setStudents([]);
    setHourAttendance({});

    try {
      // Fetch student list and any saved attendance for this hour in parallel
      const [studentsResult, existingResult] = await Promise.all([
        supabase.from("students").select("*").order("reg_no", { ascending: true }),
        supabase
          .from("attendance")
          .select("register_number, status")
          .eq("attendance_date", attendanceDate)
          .eq("hour", period.hour)           // DB hour
          .eq("subject_code", period.subjectCode),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (existingResult.error) throw existingResult.error;

      const loadedStudents = studentsResult.data || [];

      // attendance table uses 'register_number'; students table uses 'reg_no'
      // The actual VALUES are the same string (e.g. RA2411003020126)
      const existingStatusMap = {};
      (existingResult.data || []).forEach((rec) => {
        existingStatusMap[rec.register_number] = rec.status;
      });

      const existingCount = existingResult.data?.length ?? 0;

      // Build status map: saved status if exists, otherwise "Present"
      const statuses = {};
      loadedStudents.forEach((student) => {
        const regNo = getStudentRegNo(student); // student.reg_no value
        statuses[regNo] = existingStatusMap[regNo] ?? "Present";
      });

      setStudents(loadedStudents);
      setHourAttendance(statuses);

      if (existingCount > 0) {
        setMessage(
          `Hour ${period.displayHour} — ${period.subjectName}: ${existingCount} existing record(s) loaded. You can update and re-save.`
        );
      }
    } catch (e) {
      setError(getFriendlyError(e, "Unable to load student records."));
    } finally {
      setStudentsLoading(false);
    }
  }

  // Toggle a single student's status
  function markAttendance(studentId, status) {
    setHourAttendance((current) => ({ ...current, [studentId]: status }));
  }

  // Set all students to the same status
  function markAll(status) {
    setHourAttendance(
      students.reduce((acc, student) => {
        acc[getStudentRegNo(student)] = status;
        return acc;
      }, {})
    );
  }

  async function saveAttendance() {
    if (!selectedSubject) {
      setMessage("Select a valid subject hour before saving attendance.");
      return;
    }
    if (hourRecords.length === 0) {
      setMessage("No student records loaded. Click an hour card first.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      // Step 1: Fetch existing records for this exact date + hour + subject
      const { data: existingRecords, error: fetchErr } = await supabase
        .from("attendance")
        .select("id, register_number, status")
        .eq("attendance_date", attendanceDate)
        .eq("hour", selectedHour)                    // DB hour
        .eq("subject_code", selectedSubject.subjectCode);

      if (fetchErr) throw fetchErr;

      // Build lookup: register_number → { id, status }
      const existingMap = {};
      (existingRecords || []).forEach((r) => {
        existingMap[r.register_number] = { id: r.id, status: r.status };
      });

      // Step 2: Classify each student's record
      const toInsert = [];
      const toUpdate = []; // { id, status }

      hourRecords.forEach((record) => {
        const existing = existingMap[record.registrationNumber];
        if (existing) {
          if (existing.status !== record.status) {
            toUpdate.push({ id: existing.id, status: record.status });
          }
        } else {
          toInsert.push({
            attendance_date: attendanceDate,
            day: dayName,
            hour: selectedHour,                      // DB hour
            register_number: record.registrationNumber,
            subject_code: selectedSubject.subjectCode,
            status: record.status,
          });
        }
      });

      // Step 3: Batch INSERT
      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase.from("attendance").insert(toInsert);
        if (insertErr) throw insertErr;
      }

      // Step 4: Batch UPDATE (group by status to minimise round-trips)
      if (toUpdate.length > 0) {
        const presentIds = toUpdate.filter((u) => u.status === "Present").map((u) => u.id);
        const absentIds = toUpdate.filter((u) => u.status === "Absent").map((u) => u.id);

        if (presentIds.length > 0) {
          const { error: e } = await supabase
            .from("attendance")
            .update({ status: "Present" })
            .in("id", presentIds);
          if (e) throw e;
        }
        if (absentIds.length > 0) {
          const { error: e } = await supabase
            .from("attendance")
            .update({ status: "Absent" })
            .in("id", absentIds);
          if (e) throw e;
        }
      }

      // Step 5: Refresh local stats without a full re-fetch
      setAttendanceRecords((prev) => {
        const filtered = prev.filter(
          (r) =>
            !(
              r.attendance_date === attendanceDate &&
              getAttendanceHour(r) === selectedHour &&
              getAttendanceSubjectCode(r) === selectedSubject.subjectCode
            )
        );
        const fresh = hourRecords.map((rec) => ({
          attendance_date: attendanceDate,
          day: dayName,
          hour: selectedHour,
          register_number: rec.registrationNumber,
          subject_code: selectedSubject.subjectCode,
          status: rec.status,
        }));
        return [...filtered, ...fresh];
      });

      const detail = [];
      if (toInsert.length > 0) detail.push(`${toInsert.length} new`);
      if (toUpdate.length > 0) detail.push(`${toUpdate.length} updated`);

      if (detail.length === 0) {
        setMessage("No changes detected — attendance was already up to date.");
      } else {
        setMessage(
          `Attendance saved successfully. ${detail.join(", ")} (${hourRecords.length} students total).`
        );
      }
    } catch (e) {
      setError(getFriendlyError(e, "Unable to save attendance."));
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-stack">
      <section className="section-heading">
        <div>
          <span className="eyebrow">CR Hour-wise Attendance</span>
          <h2>Attendance</h2>
        </div>
      </section>

      {error && <p className="status danger">{error}</p>}
      {message && <p className="status">{message}</p>}

      {/* ── Semester summary cards ── */}
      <section className="attendance-summary-grid">
        <article className="attendance-summary-card">
          <span>Overall Attendance</span>
          <strong>{overallAttendance.toFixed(2)}%</strong>
          <p>Formula: attended hours / conducted hours x total students</p>
        </article>
        <article className="attendance-summary-card">
          <span>Regular Subjects</span>
          <strong>{loading ? "..." : subjects.length}</strong>
          <p>Community Connect excluded</p>
        </article>
        <article className="attendance-summary-card success">
          <span>Attended Hours</span>
          <strong>{totalAttendedHours}</strong>
          <p>Total present records marked</p>
        </article>
        <article className="attendance-summary-card">
          <span>Conducted Hours</span>
          <strong>{totalConductedHours}</strong>
          <p>Total regular semester hours conducted</p>
        </article>
      </section>

      {/* ── Controls ── */}
      <section className="attendance-controls panel">
        <label>
          Date
          <input
            type="date"
            value={attendanceDate}
            onChange={(e) => {
              setAttendanceDate(e.target.value);
              setMessage("");
            }}
          />
        </label>
        <label>
          Current Semester Subjects
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            disabled={loading || subjects.length === 0}
          >
            <option value="All Subjects">All Subjects</option>
            {subjects.map((s) => (
              <option key={getSubjectCode(s)} value={getSubjectCode(s)}>
                {getSubjectCode(s)} — {getSubjectName(s)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="save-attendance-button"
          type="button"
          onClick={saveAttendance}
          disabled={saving || !selectedSubject}
        >
          {saving ? "Saving..." : "Save Hour Attendance"}
        </button>
      </section>

      {/* ── Class schedule (hour cards) ── */}
      <section className="panel">
        <div className="panel-header">
          <h3>Class Schedule</h3>
          <span>
            {attendanceDate} - {dayName}
          </span>
        </div>
        <div className="hour-schedule-grid">
          {daySchedule.map((period) => {
            const active = selectedHour === period.hour; // compare by DB hour
            return (
              <button
                className={`hour-card${active ? " active" : ""}`}
                key={`${period.subjectCode || period.type || "hour"}-${period.hour}`}
                type="button"
                disabled={period.disabled}
                onClick={() => {
                  setSelectedHour(period.hour);               // store DB hour internally
                  setSelectedDisplayHour(period.displayHour); // store UI number for display
                  fetchStudentsForHour(period);
                }}
              >
                <span>Hour {period.displayHour}</span>
                <strong>{period.shortName || "-"}</strong>
                <small>{period.subjectCode || period.subjectName || "No subject"}</small>
              </button>
            );
          })}
        </div>
        {(loading || timetableLoading) && <p>Loading timetable...</p>}
        {!loading && WEEKEND_DAYS.has(dayName) && <p>No classes scheduled.</p>}
        {!loading && !timetableLoading && !WEEKEND_DAYS.has(dayName) && daySchedule.length === 0 && (
          <p>No timetable periods found for {dayName}.</p>
        )}
      </section>

      {/* ── Hour-level summary cards ── */}
      <section className="attendance-summary-grid">
        <article className="attendance-summary-card">
          <span>Selected Hour</span>
          <strong>Hour {selectedDisplayHour}</strong>
          <p>
            {selectedSubject
              ? `${selectedSubject.subjectCode} - ${selectedSubject.subjectName}`
              : "No subject selected"}
          </p>
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
          <strong>{studentsLoading ? "..." : hourRecords.length}</strong>
          <p>CR can update each hour separately</p>
        </article>
      </section>

      {/* ── Hour-wise marking table ── */}
      <section className="panel">
        <div className="panel-header">
          <h3>Hour-wise Marking</h3>
          <span>
            Hour {selectedDisplayHour} -{" "}
            {selectedSubject ? selectedSubject.subjectCode : "No subject"}
          </span>
        </div>
        <div className="segmented-actions">
          <button
            type="button"
            onClick={() => markAll("Present")}
            disabled={!selectedSubject || hourRecords.length === 0}
          >
            Mark All Present
          </button>
          <button
            type="button"
            onClick={() => markAll("Absent")}
            disabled={!selectedSubject || hourRecords.length === 0}
          >
            Mark All Absent
          </button>
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
                  <td>Hour {selectedDisplayHour}</td>
                  <td>
                    <strong>{selectedSubject ? selectedSubject.shortName : "-"}</strong>
                    <span className="table-subtext">
                      {selectedSubject ? selectedSubject.subjectName : "No subject selected"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status ${record.status === "Present" ? "success" : "danger"}`}
                    >
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
              {studentsLoading && (
                <tr>
                  <td colSpan="6">Loading students...</td>
                </tr>
              )}
              {!studentsLoading && selectedSubject && hourRecords.length === 0 && (
                <tr>
                  <td colSpan="6">Click a valid hour card above to load student records.</td>
                </tr>
              )}
              {!selectedSubject && (
                <tr>
                  <td colSpan="6">
                    Attendance is disabled for Break, Free, or empty timetable hours.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Subject-wise summary table ── */}
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
                const subjectRecords = attendanceRecords.filter(
                  (r) => getAttendanceSubjectCode(r) === summary.subjectCode
                );
                const pct =
                  subjectRecords.length > 0
                    ? (summary.attendedHours / subjectRecords.length) * 100
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
                      <span className={`status ${pct < 75 ? "danger" : "success"}`}>
                        {pct.toFixed(2)}%
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
