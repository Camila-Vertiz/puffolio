import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className="navLink"
      style={({ isActive }) => ({
        borderColor: isActive ? "var(--border)" : "transparent",
        background: isActive ? "rgba(255, 255, 255, 0.05)" : "transparent",
        color: isActive ? "var(--text-primary)" : "var(--muted)",
      })}
      end={to === "/"}
    >
      {label}
    </NavLink>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const email = auth.currentUser?.email ?? "Signed in";
  const isAdminPath = location.pathname.startsWith("/admin");

  return (
    <>
      <header className="nav">
        <div className="navInner">
          <div className="brand">
            <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="brandTitle">Puffolio</span>
            </Link>
            <span className="brandTag">Quiz Platform</span>
          </div>

          <nav className="navLinks" aria-label="Primary">
            <NavItem to="/" label="Home" />
            <NavItem to="/review" label="Weak Review" />
            <NavItem to="/admin" label="Admin" />
          </nav>

          <div className="navRight">
            <span className="userPill" title={email}>
              {email}
            </span>
            {!isAdminPath && (
              <button className="btn" onClick={() => signOut(auth)}>
                Logout
              </button>
            )}
            {isAdminPath && (
              <button className="btn" onClick={() => signOut(auth)}>
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      {/* pages already have .page + .container, so just render */}
      <Outlet />
    </>
  );
}
