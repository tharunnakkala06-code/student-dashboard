import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { supabase } from "../services/supabase";

const sections = [
  {
    title: "Personal Information",
    fields: [
      ["Registration Number", "reg_no"],
      ["Student Name", "student_name"],
      ["Gender", "gender"],
      ["Caste", "caste"],
      ["Date of Birth", "date_of_birth"],
      ["Blood Group", "blood_group"],
    ],
  },
  {
    title: "Contact Information",
    fields: [
      ["Official Email", "official_email"],
      ["Personal Email", "personal_email"],
      ["Phone Number", "phone_number"],
    ],
  },
  {
    title: "Family Information",
    fields: [
      ["Father Name", "father_name"],
      ["Father Occupation", "father_occupation"],
      ["Father Phone", "father_phone"],
      ["Mother Name", "mother_name"],
      ["Mother Occupation", "mother_occupation"],
      ["Mother Phone", "mother_phone"],
    ],
  },
  {
    title: "Address Information",
    fields: [
      ["Communication Address", "communication_address"],
      ["Permanent Address", "permanent_address"],
      ["State", "state"],
    ],
  },
  {
    title: "Identity Information",
    fields: [
      ["Aadhaar Number", "aadhar_no"],
      ["PAN Number", "pan_no"],
    ],
  },
  {
    title: "Hostel Information",
    fields: [
      ["Hostel Status", "hostel_status"],
      ["Hostel Block", "hostel_block"],
      ["Room Number", "room_no"],
    ],
  },
];

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function getVisibleFields(student, fields) {
  return fields.filter(([, key]) => hasValue(student?.[key]));
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "ST";
  }

  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}

function StudentProfile() {
  const { reg_no } = useParams();
  const [activeTab, setActiveTab] = useState(sections[0].title);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchStudent() {
      setLoading(true);
      setError("");

      try {
        const { data, error: fetchError } = await supabase
          .from("students")
          .select("*")
          .eq("reg_no", reg_no)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        setStudent(data);
      } catch (fetchError) {
        setError(fetchError.message || "Unable to load student profile.");
      } finally {
        setLoading(false);
      }
    }

    fetchStudent();
  }, [reg_no]);

  const activeSection = sections.find((section) => section.title === activeTab) || sections[0];
  const visibleFields = useMemo(
    () => getVisibleFields(student, activeSection.fields),
    [activeSection.fields, student],
  );

  if (loading) {
    return (
      <div className="page-stack">
        <section className="student-profile-card">
          <div>
            <span className="eyebrow">Student Profile</span>
            <h2>Loading profile...</h2>
          </div>
        </section>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="page-stack">
        <section className="student-profile-card">
          <div>
            <span className="eyebrow">Student Profile</span>
            <h2>Profile unavailable</h2>
            <p className="status danger">{error || "Student record was not found."}</p>
          </div>
          <div className="profile-actions">
            <Link className="text-link" to="/students">Back to students</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="student-profile-card">
        <div className="profile-identity">
          <div className="profile-avatar">
            {getInitials(student.student_name)}
          </div>
          <div>
            <span className="eyebrow">Student Profile</span>
            <h2>{student.student_name}</h2>
            <p>{student.reg_no}</p>
          </div>
        </div>

        <div className="profile-actions">
          <Link className="text-link" to="/students">Back to students</Link>
        </div>
      </section>

      <section className="profile-summary-grid">
        <article className="profile-metric">
          <span>Gender</span>
          <strong>{student.gender || "Not provided"}</strong>
          <p>Personal information</p>
        </article>
        <article className="profile-metric">
          <span>Official Email</span>
          <strong>{student.official_email || "Not provided"}</strong>
          <p>Contact information</p>
        </article>
        <article className="profile-metric">
          <span>Hostel Status</span>
          <strong>{student.hostel_status || "Not provided"}</strong>
          <p>{student.hostel_block || student.room_no ? [student.hostel_block, student.room_no].filter(Boolean).join(", ") : "No hostel room assigned"}</p>
        </article>
        <article className="profile-metric">
          <span>State</span>
          <strong>{student.state || "Not provided"}</strong>
          <p>Address information</p>
        </article>
      </section>

      <section className="profile-tabs-card">
        <div className="profile-tabs" role="tablist" aria-label="Student profile sections">
          {sections.map((section) => (
            <button
              key={section.title}
              type="button"
              className={activeTab === section.title ? "active" : ""}
              onClick={() => setActiveTab(section.title)}
              role="tab"
              aria-selected={activeTab === section.title}
            >
              {section.title}
            </button>
          ))}
        </div>

        <article className="info-panel tab-panel" role="tabpanel">
          <div className="panel-header">
            <h3>{activeSection.title}</h3>
            <span>{visibleFields.length} fields</span>
          </div>
          {visibleFields.length === 0 ? (
            <p>No details available.</p>
          ) : (
            <dl>
              {visibleFields.map(([label, key]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{student[key]}</dd>
                </div>
              ))}
            </dl>
          )}
        </article>
      </section>
    </div>
  );
}

export default StudentProfile;
