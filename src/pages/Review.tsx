import { Link } from "react-router-dom";

export default function Review() {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>Weak Questions Review</h2>
      <p style={{ opacity: 0.8 }}>
        Draft page. Later this will query Firestore: users/{`{uid}`}
        /questionStats where isWeak==true.
      </p>

      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 800 }}>No weak questions yet (draft)</div>
        <div style={{ marginTop: 8, opacity: 0.7 }}>
          Take a quiz first. Your wrong answers will appear here.
        </div>

        <div style={{ marginTop: 12 }}>
          <Link to="/" style={{ textDecoration: "none" }}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
