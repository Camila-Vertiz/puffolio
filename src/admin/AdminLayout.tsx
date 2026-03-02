import { NavLink, Outlet } from "react-router-dom";

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className="navLink"
      style={({ isActive }) => ({
        borderColor: isActive ? "var(--border)" : "transparent",
        background: isActive ? "#fff" : "transparent",
      })}
      end
    >
      {label}
    </NavLink>
  );
}

export default function AdminLayout() {
  return (
    <div className="page">
      <div className="container">
        <div className="spaceBetween" style={{ marginBottom: 14 }}>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Admin
            </div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>Back Office</div>
          </div>

          <div className="row">
            <Tab to="/admin/topics" label="Topics" />
            <Tab to="/admin/questions" label="Questions" />
            <Tab to="/admin/quizzes" label="Quizzes" />
          </div>
        </div>

        <Outlet />
      </div>
    </div>
  );
}
