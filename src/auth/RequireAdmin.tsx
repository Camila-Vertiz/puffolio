import { Navigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { auth, db } from "../firebase";
import { useAuth } from "./useAuth";

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!user) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }

      const snap = await getDoc(doc(db, "admins", user.uid));
      setIsAdmin(snap.exists());
      setChecking(false);
    };

    run();
  }, [user]);

  if (loading || checking) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!auth.currentUser) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
