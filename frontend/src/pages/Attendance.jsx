import { useEffect, useMemo, useState } from "react";

import { supabase } from "../services/supabase";

const HOUR_COUNT = 8;
const NON_ATTENDANCE_PERIODS = new Set(["BREAK", "FREE"]);
const WEEKEND_DAYS = new Set(["Saturday", "Sunday"]);

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
  if (!dateValue) {
    return "";
  }

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

function isBreakOrFree(period) {
  const subjectCode = (period?.subjectCode || "").trim().toUpperCase();
  const subjectName = (period?.subjectName || "").trim().toUpperCase();

  return (
    NON_ATTENDANCE_PERIODS.has(subjectCode) ||
    NON_ATTENDANCE_PERIODS.has(subjectName) ||
    NON_ATTENDANCE_PERIODS.has((period?.type || "").toUpperCase())
  );
}

function buildSchedule(timetableRows, subjects, dayName) {
  if (WEEKEND_DAYS.has(dayName)) {
    return Array.from({ length: HOUR_COUNT }, (_, index) => ({
      hour: index + 1,
      displayHour: index + 1,
      subjectCode: "",
      subjectName: "No classes scheduled.",
      shortName: "No classes scheduled.",
      disabled: true,
      type: "WEEKEND",
    }));
  }

  // subjects table used as a fallback lookup by subject_code
  const subjectByCode = new Map(subjects.map((subject) => [getSubjectCode(subject), subject]));

  // Get all rows for this day, sorted by original DB hour ascending
  const dayRows = timetableRows
    .filter((row) => isSelectedTimetableDay(row, dayName))
    .sort((a, b) => getTimetableHour(a) - getTimetableHour(b));

  // Keep ONLY actual teaching periods — filter out BREAK and FREE entirely
  const teachingRows = dayRows.filter((row) => {
    const code = (getValue(row, ["subject_code", "subjectCode", "code"]) || "").trim().toUpperCase();
    const name = (getValue(row, ["subject_name", "subjectName", "name"]) || "").trim().toUpperCase();
    return !NON_ATTENDANCE_PERIODS.has(code) && !NON_ATTENDANCE_PERIODS.has(name);
  });

  // Build schedule: sequential displayHour for the UI, but preserve original DB hour
  return teachingRows.map((row, index) => {
    const dbHour     = getTimetableHour(row); // Original DB hour — used for saving & queries
    const displayHour = index + 1;             // Sequential UI number — display only
    const subjectCode = getValue(row, ["subject_code", "subjectCode", "code"]);
    const linkedSubject = subjectCode ? subjectByCode.get(subjectCode) : null;
    const subjectName = getValue(row, ["subject_name", "subjectName", "name"], getSubjectName(linkedSubject));

    return {
      hour: dbHour,        // DB hour — preserved for all Supabase operations
      displayHour,         // UI-only sequential number — never saved to DB
      subjectCode,
      subjectName,
      shortName: getValue(row, ["short_name", "shortName"], subjectName || subjectCode),
      disabled: false,     // All teaching periods are selectable
      type: "TEACHING",
    };
  });
}

function summarizeAttendance(subjects, attendanceRecords) {
  return subjects.map((subject) => {
    const subjectCode = getSubjectCode(subject);
    const subjectRecords = attendanceRecords.filter((record) => getAttendanceSubjectCode(record) === subjectCode);
    const conductedHours = new Set(
      subjectRecords.map((record) => `${record.attendance_date}-${getAttendanceHour(record)}`),
    ).size;
    const attendedHours = subjectRecords.filter((record) => getAttendanceStatus(record) === "Present").length;

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

function Attendance() {
  const today = new Date().toISOString().slice(0, 10);
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
  const [selectedHour, setSelectedHour] = useState(1);         // DB hour — used for Supabase queries
  const [selectedDisplayHour, setSelectedDisplayHour] = useState(1); // UI number — display only
  const [hourAttendance, setHourAttendance] = useState({});
  const [subjectFilter, setSubjectFilter] = useState("All Subjects");
  const dayName = useMemo(() => getDayName(attendanceDate), [attendanceDate]);
  const daySchedule = useMemo(
    () => buildSchedule(timetableRows, subjects, dayName),
    [timetableRows, subjects, dayName],
  );
  // selectedSubject: find the period whose DB hour matches the selected DB hour
  const selectedPeriod = daySchedule.find((period) => period.hour === selectedHour) || null;
  const selectedSubject = selectedPeriod && !selectedPeriod.disabled ? selectedPeriod : null;
  const filteredAttendanceRecords = useMemo(() => {
    if (subjectFilter === "All Subjects") return attendanceRecords;
    return attendanceRecords.filter((record) => getAttendanceSubjectCode(record) === subjectFilter);
  }, [attendanceRecords, subjectFilter]);
  const subjectAttendanceSummary = useMemo(
    () => summarizeAttendance(
      subjectFilter === "All Subjects" ? subjects : subjects.filter((s) => getSubjectCode(s) === subjectFilter),
      attendanceRecords,
    ),
    [subjects, attendanceRecords, subjectFilter],
  );
  const totalConductedHours = subjectAttendanceSummary.reduce(
    (total, subject) => total + subject.conductedHours,
    0,
  );
  const totalAttendedHours = filteredAttendanceRecords.filter((record) => getAttendanceStatus(record) === "Present").length;
  const overallAttendance = filteredAttendanceRecords.length > 0
    ? (totalAttendedHours / filteredAttendanceRecords.length) * 100
    : 0;

  // Load subjects on startup (blocks UI minimally — fast query)
  useEffect(() => {
    async function fetchSubjects() {
      setLoading(true);
      setError("");

      try {
        const { data, error: subjectsError } = await supabase
          .from("subjects")
          .select("*");

        if (subjectsError) {
          throw subjectsError;
        }

        setSubjects(data || []);
      } catch (fetchError) {
        setError(getFriendlyError(fetchError, "Unable to load subject data."));
      } finally {
        setLoading(false);
      }
    }

    fetchSubjects();
  }, []);

  // Load all attendance records in the background for stats (non-blocking)
  useEffect(() => {
    async function fetchAttendanceStats() {
      const { data, error: attError } = await supabase
        .from("attendance")
        .select("attendance_date, day, hour, register_number, subject_code, status");

      if (!attError && data) {
        setAttendanceRecords(data);
      }
    }

    fetchAttendanceStats();
  }, []);

  useEffect(() => {
    async function fetchTimetableForDay() {
      setTimetableRows([]);

      if (WEEKEND_DAYS.has(dayName)) {
        return;
      }

      setTimetableLoading(true);
      setError("");

      try {
        const { data, error: timetableError } = await supabase
          .from("timetable")
          .select("*")
          .order("hour", { ascending: true });

        if (timetableError) {
          throw timetableError;
        }

        setTimetableRows(data || []);
      } catch (timetableError) {
        setError(getFriendlyError(timetableError, "Unable to load timetable."));
      } finally {
        setTimetableLoading(false);
      }
    }

    fetchTimetableForDay();
  }, [dayName]);


  // When the DATE changes: reset everything (new day = fresh start)
  useEffect(() => {
    setStudents([]);
    setHourAttendance({});
    setMessage("");
  }, [attendanceDate]);


  // When the SCHEDULE changes (timetable loaded / day changed): auto-select the first teaching period
  // This must NOT clear students or hourAttendance — that would wipe marks mid-session
  useEffect(() => {
    const firstPeriod = daySchedule.find((period) => !period.disabled);
    setSelectedHour(firstPeriod?.hour || 1);
    setSelectedDisplayHour(firstPeriod?.displayHour || 1);
  }, [daySchedule]);

  async function fetchStudentsForHour(period = selectedSubject) {
    if (!period) {
      return;
    }

    setStudentsLoading(true);
    setError("");
    setMessage("");
    // Clear previous hour's student list immediately
    setStudents([]);
    setHourAttendance({});

    try {
      // Fetch students and any existing attendance for this hour in parallel
      const [studentsResult, existingResult] = await Promise.all([
        supabase.from("students").select("*").order("reg_no", { ascending: true }),
        supabase
          .from("attendance")
          .select("register_number, status")
          .eq("attendance_date", attendanceDate)
          .eq("hour", period.hour)
          .eq("subject_code", period.subjectCode),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (existingResult.error) throw existingResult.error;

      const loadedStudents = studentsResult.data || [];

      // Build a map of existing attendance: register_number → status
      // The attendance table uses 'register_number'; students table uses 'reg_no'
      // The VALUES are the same (e.g. RA2411003020126) — map by value, not column name
      const existingStatusMap = {};
      (existingResult.data || []).forEach((rec) => {
        existingStatusMap[rec.register_number] = rec.status;
      });

      const existingCount = existingResult.data ? existingResult.data.length : 0;

      // For each student: use saved status if found, otherwise default Present
      const statuses = {};
      loadedStudents.forEach((student) => {
        const regNo = getStudentRegNo(student); // reads student.reg_no
        // Try the reg_no value directly against the attendance register_number values
        statuses[regNo] = existingStatusMap[regNo] ?? "Present";
      });

      setStudents(loadedStudents);
      // Set hourAttendance AFTER students to avoid a momentary empty-state render
      setHourAttendance(statuses);

      if (existingCount > 0) {
        setMessage(
          `Hour ${period.displayHour} — ${period.subjectName}: ${existingCount} existing record(s) loaded. You can update and re-save.`
        );
      }
    } catch (fetchError) {
      setError(getFriendlyError(fetchError, "Unable to load student records."));
    } finally {
      setStudentsLoading(false);
    }
  }

  // Derived list: one record per student with their current attendance status
  // useMemo ensures this only recomputes when students or hourAttendance actually change
  const hourRecords = useMemo(
    () =>
      students.map((student) => {
        const studentId = getStudentRegNo(student); // student.reg_no value
        return {
          id: studentId,
          registrationNumber: studentId,
          name: getStudentName(student),
          status: hourAttendance[studentId] ?? "Present",
        };
      }),
    [students, hourAttendance],
  );
  const presentCount = useMemo(
    () => hourRecords.filter((r) => r.status === "Present").length,
    [hourRecords],
  );
  const absentCount = hourRecords.length - presentCount;

  function markAttendance(studentId, status) {
    setHourAttendance((currentAttendance) => ({
      ...currentAttendance,
      [studentId]: status,
    }));
  }

  function markAll(status) {
    setHourAttendance(
      students.reduce((statuses, student) => {
        statuses[getStudentRegNo(student)] = status;
        return statuses;
      }, {}),
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
      // Step 1: Fetch all existing records for this date + hour + subject
      const { data: existingRecords, error: fetchError } = await supabase
        .from("attendance")
        .select("id, register_number, status")
        .eq("attendance_date", attendanceDate)
        .eq("hour", selectedHour)
        .eq("subject_code", selectedSubject.subjectCode);

      if (fetchError) throw fetchError;

      // Build a lookup: register_number → { id, status }
      const existingMap = {};
      (existingRecords || []).forEach((r) => {
        existingMap[r.register_number] = { id: r.id, status: r.status };
      });

      // Step 2: Split into records to INSERT and records to UPDATE
      const toInsert = [];
      const toUpdate = []; // { id, newStatus }

      hourRecords.forEach((record) => {
        const existing = existingMap[record.registrationNumber];
        if (existing) {
          // Only push an update if the status has actually changed
          if (existing.status !== record.status) {
            toUpdate.push({ id: existing.id, status: record.status });
          }
        } else {
          toInsert.push({
            attendance_date: attendanceDate,
            day: dayName,
            hour: selectedHour,
            register_number: record.registrationNumber,
            subject_code: selectedSubject.subjectCode,
            status: record.status,
          });
        }
      });

      // Step 3: INSERT new records (batch)
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("attendance")
          .insert(toInsert);
        if (insertError) throw insertError;
      }

      // Step 4: UPDATE changed records (batch by status to minimise round-trips)
      if (toUpdate.length > 0) {
        const presentIds = toUpdate.filter((u) => u.status === "Present").map((u) => u.id);
        const absentIds  = toUpdate.filter((u) => u.status === "Absent").map((u) => u.id);

        if (presentIds.length > 0) {
          const { error: upErr } = await supabase
            .from("attendance")
            .update({ status: "Present" })
            .in("id", presentIds);
          if (upErr) throw upErr;
        }
        if (absentIds.length > 0) {
          const { error: upErr } = await supabase
            .from("attendance")
            .update({ status: "Absent" })
            .in("id", absentIds);
          if (upErr) throw upErr;
        }
      }

      // Step 5: Refresh local attendanceRecords state without a full refetch
      // Remove old records for this date+hour+subject, then splice in current state
      setAttendanceRecords((prev) => {
        const filtered = prev.filter(
          (r) =>
            !(r.attendance_date === attendanceDate &&
              getAttendanceHour(r) === selectedHour &&
              getAttendanceSubjectCode(r) === selectedSubject.subjectCode)
        );
        // Append the current marking for every student
        const freshRecords = hourRecords.map((record) => ({
          attendance_date: attendanceDate,
          day: dayName,
          hour: selectedHour,
          register_number: record.registrationNumber,
          subject_code: selectedSubject.subjectCode,
          status: record.status,
        }));
        return [...filtered, ...freshRecords];
      });

      const totalSaved = toInsert.length + toUpdate.length;
      const detail = [];
      if (toInsert.length > 0) detail.push(`${toInsert.length} new`);
      if (toUpdate.length > 0) detail.push(`${toUpdate.length} updated`);
      if (totalSaved === 0) {
        setMessage("No changes detected — attendance was already up to date.");
      } else {
        setMessage(`Attendance saved successfully. ${detail.join(", ")} (${hourRecords.length} students total).`);
      }
    } catch (saveError) {
      setError(getFriendlyError(saveError, "Unable to save attendance."));
    } finally {
      setSaving(false);
    }
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
      {message && <p className="status">{message}</p>}

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

      <section className="attendance-controls panel">
        <label>
          Date
          <input
            type="date"
            value={attendanceDate}
            onChange={(event) => {
              setAttendanceDate(event.target.value);
              setMessage("");
            }}
          />
        </label>
        <label>
          Current Semester Subjects
          <select
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
            disabled={loading || subjects.length === 0}
          >
            <option value="All Subjects">All Subjects</option>
            {subjects.map((subject) => (
              <option key={getSubjectCode(subject)} value={getSubjectCode(subject)}>
                {getSubjectCode(subject)} — {getSubjectName(subject)}
              </option>
            ))}
          </select>
        </label>
        <button className="save-attendance-button" type="button" onClick={saveAttendance} disabled={saving || !selectedSubject}>
          {saving ? "Saving..." : "Save Hour Attendance"}
        </button>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Class Schedule</h3>
          <span>{attendanceDate} - {dayName}</span>
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
        {!loading && !timetableLoading && !WEEKEND_DAYS.has(dayName) && daySchedule.length === 0 && <p>No timetable periods found for {dayName}.</p>}
      </section>

      <section className="attendance-summary-grid">
        <article className="attendance-summary-card">
          <span>Selected Hour</span>
          <strong>Hour {selectedDisplayHour}</strong>
          <p>{selectedSubject ? `${selectedSubject.subjectCode} - ${selectedSubject.subjectName}` : "No subject selected"}</p>
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

      <section className="panel">
        <div className="panel-header">
          <h3>Hour-wise Marking</h3>
          <span>Hour {selectedDisplayHour} - {selectedSubject ? selectedSubject.subjectCode : "No subject"}</span>
        </div>
        <div className="segmented-actions">
          <button type="button" onClick={() => markAll("Present")} disabled={!selectedSubject || hourRecords.length === 0}>
            Mark All Present
          </button>
          <button type="button" onClick={() => markAll("Absent")} disabled={!selectedSubject || hourRecords.length === 0}>
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
                    <span className="table-subtext">{selectedSubject ? selectedSubject.subjectName : "No subject selected"}</span>
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
                  <td colSpan="6">Attendance is disabled for Break, Free, or empty timetable hours.</td>
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
                const subjectRecords = attendanceRecords.filter((record) => getAttendanceSubjectCode(record) === summary.subjectCode);
                const percentage = subjectRecords.length > 0 ? (summary.attendedHours / subjectRecords.length) * 100 : 0;

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
