import { Link } from "react-router-dom";

export default function AdminHome() {
  return (
    <div style={{ padding: 24 }}>
      <h2>Admin</h2>
      <ul>
        <li>
          <Link to="/admin/topics">Topics</Link>
        </li>
        <li>
          <Link to="/admin/questions">Questions</Link>
        </li>
        <li>
          <Link to="/admin/quizzes">Quizzes</Link>
        </li>
      </ul>
    </div>
  );
}
