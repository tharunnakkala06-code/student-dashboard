import { Outlet } from "react-router-dom";

import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="workspace">
        <Navbar />
        <main className="page-frame">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
