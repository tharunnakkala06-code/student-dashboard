import { NavLink, useNavigate } from "react-router-dom";

import { clearMockUser, getCurrentUser, isStudent } from "../services/mockAuth";

const navItems = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Students", path: "/students" },
  { label: "Attendance", path: "/attendance" },
  { label: "Achievements", path: "/achievements" },
  { label: "Notices", path: "/notices" },
];

function Sidebar() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const visibleNavItems = isStudent(currentUser)
    ? navItems.filter((item) => ["Dashboard", "Achievements", "Notices"].includes(item.label))
    : navItems;

  function handleLogout() {
    clearMockUser();
    navigate("/");
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">{isStudent(currentUser) ? "ST" : "FA"}</div>
        <div>
          <strong>{isStudent(currentUser) ? "Student Desk" : "Advisor Desk"}</strong>
          <span>CSE C Dashboard</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        {visibleNavItems.map((item) => (
          <NavLink key={item.path} to={item.path}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <button className="logout-button" type="button" onClick={handleLogout}>
        Logout
      </button>

      <footer className="sidebar-footer">
        <span>Coded by</span>
        <strong>Mr. N. Tharun</strong>
        <a href="https://www.linkedin.com/in/tharunnakkala06" target="_blank" rel="noreferrer">
          LinkedIn
        </a>
      </footer>
    </aside>
  );
}

export default Sidebar;
