import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./experience.css";
import "./finale.css";
import "./rail.css";
import "./map.css";
import "./portraits.css";
import "./home.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("找不到应用挂载节点。");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
