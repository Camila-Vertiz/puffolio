import { Link } from "react-router-dom";

export default function Review() {
  return (
    <div className="page">
      <div className="container">
        <div className="spaceBetween">
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Practice
            </div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>Weak Questions</div>
          </div>
          <Link className="btn" to="/">
            Home
          </Link>
        </div>

        <section className="card" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 900 }}>Draft page</div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Later we’ll load weak questions from Firestore:
            <br />
            <code>users/{`{uid}`}/questionStats</code> where{" "}
            <code>isWeak == true</code>
          </p>
        </section>
      </div>
    </div>
  );
}
