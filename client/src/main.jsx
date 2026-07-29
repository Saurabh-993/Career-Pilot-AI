// Entry point: attaches the React app to the #root div in index.html.
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* BrowserRouter enables URL-based navigation (/companies, /practice, …) */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
