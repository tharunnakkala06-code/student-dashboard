import { useState } from "react";
import { useNavigate } from "react-router-dom";

import srmLogo from "../assets/srm-logo.png";
import { setMockUser } from "../services/mockAuth";

function Login() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState("Faculty");

  function handleLogin() {
    setMockUser(selectedRole);
    navigate("/dashboard");
  }

  return (
    <div className="login-page">
      <section className="login-panel">
        <div className="login-copy">
          <div className="login-branding">
            <img src={srmLogo} alt="SRM Institute of Science and Technology logo" />
            <div>
              <strong>SRM Institute of Science and Technology</strong>
              <span>Chennai Ramapuram Campus</span>
            </div>
          </div>
          <h1>III CSE C Administration Portal</h1>
          <p>
            Track student records, attendance, achievements and notices from one
            centralized platform.
          </p>
        </div>

        <form className="login-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Email
            <input type="email" placeholder="advisor@srmist.edu.in" />
          </label>

          <label>
            Password
            <input type="password" placeholder="Enter password" />
          </label>

          <label>
            Role
            <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>
              <option>Faculty</option>
              <option>CR</option>
              <option>Student</option>
            </select>
          </label>

          <button type="button" onClick={handleLogin}>
            Login
          </button>
        </form>
      </section>
    </div>
  );
}

export default Login;
