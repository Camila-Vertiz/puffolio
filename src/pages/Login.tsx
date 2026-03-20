import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();

  const login = async () => {
    await signInWithPopup(auth, googleProvider);
    nav("/");
  };

  return (
    <div
      className="page"
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div className="container" style={{ maxWidth: 420 }}>
        <section className="card" style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 24 }}>
            <div className="brandTitle" style={{ fontSize: 36, display: "flex", justifyContent: "center" }}>
              Puffolio
            </div>
            <div className="subtitle" style={{ marginTop: 8 }}>
              Banqueo-style learning • Total timer • Study & Exam mode
            </div>
          </div>

          <button
            onClick={login}
            className="btn btnPrimary"
            style={{
              width: "100%",
              height: 44,
              fontWeight: 600,
            }}
          >
            Continue with Google
          </button>

          <div className="muted" style={{ marginTop: 14, fontSize: 12 }}>
            Secure authentication powered by Firebase
          </div>
        </section>
      </div>
    </div>
  );
}
