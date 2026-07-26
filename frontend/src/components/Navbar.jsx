import { getCurrentUser, isStudent } from "../services/mockAuth";

function Navbar() {
  const currentUser = getCurrentUser();
  const studentUser = isStudent(currentUser);
  const initials = currentUser.name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">{studentUser ? "Student Dashboard" : "Faculty Advisor Dashboard"}</span>
        <h1>{studentUser ? "CSE C Student Portal" : "CSE C Administration"}</h1>
      </div>
      <div className="topbar-actions">
        <label className="top-search">
          <span>Search</span>
          <input
            type="search"
            placeholder={studentUser ? "Notice or achievement" : "Student, notice, achievement"}
          />
        </label>
        <div className="advisor-card">
          <div className="avatar">{initials}</div>
          <div>
            <strong>{currentUser.name}</strong>
            <span>{currentUser.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
