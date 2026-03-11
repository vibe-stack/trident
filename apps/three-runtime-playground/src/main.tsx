import ReactDOM from "react-dom/client";
import "./styles.css";
import { App } from "./App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element.");
}

ReactDOM.createRoot(root).render(<App />);
