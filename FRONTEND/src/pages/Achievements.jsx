import { useEffect, useMemo, useState } from "react";

import { getCurrentUser, isStudent } from "../services/mockAuth";
import { supabase } from "../services/supabase";

const achievementTypes = [
  "Hackathon",
  "Certification",
  "Internship",
  "Workshop",
  "Paper Presentation",
  "Sports",
  "Research",
  "Coding Contest",
  "Project Competition",
  "NPTEL",
];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "No date";
}

function Achievements() {
  const currentUser = getCurrentUser();
  const studentUser = isStudent(currentUser);
  const [achievements, setAchievements] = useState([]);
  const [formData, setFormData] = useState({
    reg_no: currentUser.id || "",
    achievement_title: "",
    achievement_type: "Hackathon",
    achievement_at: "",
    certificate_link: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const uploadedRecords = useMemo(() => {
    if (!studentUser) {
      return achievements;
    }

    return achievements.filter((achievement) => achievement.reg_no === currentUser.id);
  }, [achievements, currentUser.id, studentUser]);

  async function fetchAchievements() {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await supabase
        .from("Achievements Table")
        .select("id, reg_no, achievement_title, achievement_type, achievement_at, certificate_link, created_at")
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setAchievements(data || []);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to load achievements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadAchievements() {
      setLoading(true);
      setError("");

      try {
        const { data, error: fetchError } = await supabase
          .from("Achievements Table")
          .select("id, reg_no, achievement_title, achievement_type, achievement_at, certificate_link, created_at")
          .order("created_at", { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        setAchievements(data || []);
      } catch (fetchError) {
        setError(fetchError.message || "Unable to load achievements.");
      } finally {
        setLoading(false);
      }
    }

    loadAchievements();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const { error: insertError } = await supabase
        .from("Achievements Table")
        .insert({
          reg_no: formData.reg_no,
          achievement_title: formData.achievement_title,
          achievement_type: formData.achievement_type,
          achievement_at: formData.achievement_at,
          certificate_link: formData.certificate_link,
        });

      if (insertError) {
        throw insertError;
      }

      setFormData({
        reg_no: currentUser.id || "",
        achievement_title: "",
        achievement_type: "Hackathon",
        achievement_at: "",
        certificate_link: "",
      });
      setSuccess("Achievement record created successfully.");
      await fetchAchievements();
    } catch (insertError) {
      setError(insertError.message || "Unable to create achievement record.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="section-heading">
        <div>
          <span className="eyebrow">Achievements</span>
          <h2>Achievements</h2>
        </div>
      </section>

      <section className="content-grid">
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <h3>Student Upload Form</h3>
          <label>
            Register Number
            <input name="reg_no" type="text" value={formData.reg_no} onChange={handleChange} placeholder="Enter register number" required />
          </label>
          <label>
            Achievement Title
            <input name="achievement_title" type="text" value={formData.achievement_title} onChange={handleChange} placeholder="Enter achievement title" required />
          </label>
          <label>
            Achievement Type
            <select name="achievement_type" value={formData.achievement_type} onChange={handleChange} required>
              {achievementTypes.map((achievementType) => (
                <option key={achievementType}>{achievementType}</option>
              ))}
            </select>
          </label>
          <label>
            Achievement Date
            <input name="achievement_at" type="date" value={formData.achievement_at} onChange={handleChange} required />
          </label>
          <label>
            Certificate Link
            <input name="certificate_link" type="url" value={formData.certificate_link} onChange={handleChange} placeholder="https://example.com/certificate" required />
          </label>
          <button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Upload Record"}</button>
          {success && <p className="status success">{success}</p>}
        </form>

        <article className="panel">
          <div className="panel-header">
            <h3>Uploaded Records</h3>
            <span>{loading ? "Loading" : `${uploadedRecords.length} records`}</span>
          </div>
          {loading ? (
            <p>Loading achievements...</p>
          ) : error ? (
            <p className="status danger">{error}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Register No.</th>
                    <th>Achievement Title</th>
                    <th>Achievement Type</th>
                    <th>Achievement Date</th>
                    <th>Certificate Link</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadedRecords.map((achievement) => (
                    <tr key={achievement.id || `${achievement.reg_no}-${achievement.achievement_title}-${achievement.created_at}`}>
                      <td>{achievement.reg_no}</td>
                      <td>{achievement.achievement_title}</td>
                      <td>{achievement.achievement_type}</td>
                      <td>{formatDate(achievement.achievement_at)}</td>
                      <td>
                        {achievement.certificate_link ? (
                          <a href={achievement.certificate_link} target="_blank" rel="noreferrer">
                            View Certificate
                          </a>
                        ) : (
                          "No link"
                        )}
                      </td>
                    </tr>
                  ))}
                  {uploadedRecords.length === 0 && (
                    <tr>
                      <td colSpan="5">No achievement records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

export default Achievements;
