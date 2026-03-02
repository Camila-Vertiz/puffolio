import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import QuizRunner from "./pages/QuizRunner";
import Result from "./pages/Result";
import Review from "./pages/Review";
import RequireAuth from "./auth/RequireAuth";
import RequireAdmin from "./auth/RequireAdmin";
import AdminHome from "./admin/AdminHome";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />

        <Route
          path="/quiz/:quizId"
          element={
            <RequireAuth>
              <QuizRunner />
            </RequireAuth>
          }
        />

        <Route
          path="/result/:runId"
          element={
            <RequireAuth>
              <Result />
            </RequireAuth>
          }
        />

        <Route
          path="/review"
          element={
            <RequireAuth>
              <Review />
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminHome />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
