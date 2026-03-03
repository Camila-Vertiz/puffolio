import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Home from "./pages/Home";
import QuizRunner from "./pages/QuizRunner";
import Result from "./pages/Result";
import Review from "./pages/Review";

import RequireAuth from "./auth/RequireAuth";
import RequireAdmin from "./auth/RequireAdmin";

import AppLayout from "./layout/AppLayout";

import AdminLayout from "./admin/AdminLayout";
import TopicsPage from "./admin/TopicsPage";
import QuestionsPage from "./admin/QuestionsPage";
import QuizzesPage from "./admin/QuizzesPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Everything below requires auth + shares the same navbar */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/quiz/:quizId" element={<QuizRunner />} />
          <Route path="/result/:runId" element={<Result />} />
          <Route path="/review" element={<Review />} />

          {/* Admin protected */}
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<TopicsPage />} />
            <Route path="topics" element={<TopicsPage />} />
            <Route path="questions" element={<QuestionsPage />} />
            <Route path="quizzes" element={<QuizzesPage />} />
          </Route>
        </Route>

        <Route path="/review" element={<Review />} />
        <Route path="/review/:runId" element={<Review />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
