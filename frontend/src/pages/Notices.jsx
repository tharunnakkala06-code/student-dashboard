import { useEffect, useState } from "react";

import { getCurrentUser, isStudent } from "../services/mockAuth";
import { supabase } from "../services/supabase";

function getNoticeDate(notice) {
  return notice.notice_date || notice.created_at;
}

function isMissingTable(error) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();

  return error?.code === "42P01" || message.includes("could not find the table") || message.includes("does not exist");
}

function getFriendlyError(error, fallback) {
  if (isMissingTable(error)) {
    return "Notices table is not configured.";
  }

  if (!navigator.onLine) {
    return "Network connection is unavailable. Please check your internet connection.";
  }

  return fallback;
}

function Notices() {
  const currentUser = getCurrentUser();
  const studentUser = isStudent(currentUser);
  const [notices, setNotices] = useState([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    notice_date: "",
    target_audience: "All Students",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function fetchNotices() {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await supabase
        .from("notice_table")
        .select("*");

      if (fetchError) {
        throw fetchError;
      }

      setNotices([...(data || [])].sort((a, b) => new Date(getNoticeDate(b) || 0) - new Date(getNoticeDate(a) || 0)));
    } catch (fetchError) {
      setError(getFriendlyError(fetchError, "Unable to load notices."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadNotices() {
      setLoading(true);
      setError("");

      try {
        const { data, error: fetchError } = await supabase
          .from("notice_table")
          .select("*");

        if (fetchError) {
          throw fetchError;
        }

        setNotices([...(data || [])].sort((a, b) => new Date(getNoticeDate(b) || 0) - new Date(getNoticeDate(a) || 0)));
      } catch (fetchError) {
        setError(getFriendlyError(fetchError, "Unable to load notices."));
      } finally {
        setLoading(false);
      }
    }

    loadNotices();
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
        .from("notice_table")
        .insert({
          title: formData.title,
          description: formData.description,
          notice_date: formData.notice_date,
          target_audience: formData.target_audience,
        });

      if (insertError) {
        throw insertError;
      }

      setFormData({
        title: "",
        description: "",
        notice_date: "",
        target_audience: "All Students",
      });
      setSuccess("Notice published successfully.");
      await fetchNotices();
    } catch (insertError) {
      setError(getFriendlyError(insertError, "Unable to publish notice."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="section-heading">
        <div>
          <span className="eyebrow">Communication</span>
          <h2>Notices</h2>
        </div>
      </section>

      <section className={`content-grid${studentUser ? "" : " form-and-list"}`}>
        {!studentUser && (
          <form className="panel form-panel" onSubmit={handleSubmit}>
            <h3>Create Notice</h3>
            <label>
              Notice Title
              <input name="title" type="text" value={formData.title} onChange={handleChange} placeholder="Enter notice title" required />
            </label>
            <label>
              Audience
              <select name="target_audience" value={formData.target_audience} onChange={handleChange}>
                <option>All Students</option>
                <option>Class CR</option>
                <option>Below 75%</option>
                <option>Hostellers</option>
              </select>
            </label>
            <label>
              Notice Date
              <input name="notice_date" type="date" value={formData.notice_date} onChange={handleChange} required />
            </label>
            <label>
              Notice Message
              <textarea name="description" rows="5" value={formData.description} onChange={handleChange} placeholder="Write the notice details" required />
            </label>
            <button type="submit" disabled={submitting}>{submitting ? "Publishing..." : "Publish Notice"}</button>
            {success && <p className="status success">{success}</p>}
          </form>
        )}

        <article className="panel">
          <div className="panel-header">
            <h3>Notice List</h3>
            <span>{loading ? "Loading" : `${notices.length} notices`}</span>
          </div>
          <div className="notice-list">
            {loading && <p>Loading notices...</p>}
            {error && <p className="status danger">{error}</p>}
            {!loading && !error && notices.map((notice) => (
              <div className="notice-item" key={`${notice.title}-${getNoticeDate(notice)}-${notice.target_audience}`}>
                <strong>{notice.title}</strong>
                <span>{getNoticeDate(notice) ? new Date(getNoticeDate(notice)).toLocaleDateString() : "No date"}</span>
                <p>{notice.description}</p>
                <span>{notice.target_audience}</span>
              </div>
            ))}
            {!loading && !error && notices.length === 0 && <p>No notices found.</p>}
          </div>
        </article>
      </section>
    </div>
  );
}

export default Notices;
