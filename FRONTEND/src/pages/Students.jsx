import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../services/supabase";

function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [registrationQuery, setRegistrationQuery] = useState("");
  const [nameQuery, setNameQuery] = useState("");

  useEffect(() => {
    async function fetchStudents() {
      setLoading(true);
      setError("");

      try {
        const { data, error: fetchError } = await supabase
          .from("students")
          .select("*")
          .order("reg_no", { ascending: true });
          console.log("========== STUDENTS DEBUG =========="); console.log("DATA:", data); console.log("ERROR:", fetchError); console.log("COUNT:", data?.length); console.log("===================================");


        if (fetchError) {
          throw fetchError;
        }

        setStudents(data || []);
      } catch (err) {
        setError(fetchError.message || "Unable to load student records.");
      } finally {
        setLoading(false);
      }
    }

    fetchStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const regNo = (student.reg_no || "").toLowerCase();
      const name = (student.student_name || "").toLowerCase();

      return (
        regNo.includes(registrationQuery.toLowerCase()) &&
        name.includes(nameQuery.toLowerCase())
      );
    });
  }, [students, registrationQuery, nameQuery]);

  return (
    <div className="page-stack">
      <section className="section-heading">
        <div>
          <span className="eyebrow">Student Records</span>
          <h2>Students</h2>
        </div>
      </section>

      <section className="filter-bar">
        <label>
          Search by Registration Number
          <input
            type="search"
            value={registrationQuery}
            onChange={(e) => setRegistrationQuery(e.target.value)}
            placeholder="RA2411003020126"
          />
        </label>

        <label>
          Search by Name
          <input
            type="search"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="Student name"
          />
        </label>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Student Table</h3>
          <span>{loading ? "Loading" : `${filteredStudents.length} records`}</span>
        </div>

        {loading ? (
          <p>Loading students...</p>
        ) : error ? (
          <p className="status danger">{error}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Register No.</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Official Email</th>
                  <th>Profile</th>
                </tr>
              </thead>

              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.reg_no}>
                    <td>{student.reg_no}</td>
                    <td>{student.student_name}</td>
                    <td>{student.gender}</td>
                    <td>{student.official_email}</td>

                    <td>
                      <Link to={`/student/${student.reg_no}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan="5">No student records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Students;
