import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const nav = useNavigate();
  return (
    <div className="wrap empty" style={{ padding: "90px 20px" }}>
      <h1 style={{ fontSize: 40 }}>404</h1>
      <p style={{ margin: "8px 0 18px" }}>This page doesn't exist.</p>
      <button className="btn btn-dark" onClick={() => nav("/")}>Back home</button>
    </div>
  );
}
