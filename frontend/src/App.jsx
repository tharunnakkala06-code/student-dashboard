import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import StudentProfile from "./pages/StudentProfile";
import Attendance from "./pages/Attendance";
import Achievements from "./pages/Achievements";
import Notices from "./pages/Notices";
import { getCurrentUser, isStudent } from "./services/mockAuth";

function StudentRestrictedRoute({ children }) {
  const currentUser = getCurrentUser();

  if (isStudent(currentUser)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/students"
            element={(
              <StudentRestrictedRoute>
                <Students />
              </StudentRestrictedRoute>
            )}
          />
          <Route
            path="/student/:reg_no"
            element={(
              <StudentRestrictedRoute>
                <StudentProfile />
              </StudentRestrictedRoute>
            )}
          />
          <Route
            path="/attendance"
            element={(
              <StudentRestrictedRoute>
                <Attendance />
              </StudentRestrictedRoute>
            )}
          />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/notices" element={<Notices />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
