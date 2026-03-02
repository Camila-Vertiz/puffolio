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
    <div style={{ padding: 32 }}>
      <h1>Quiz Platform</h1>
      <button onClick={login}>Continue with Google</button>
    </div>
  );
}
