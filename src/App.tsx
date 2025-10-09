import React, { useState } from "react";
import PackageFeatureAdmin from "./components/PackageFeatureAdmin";
import RoleFeaturePermissionAdmin from "./components/RoleFeaturePermissionAdmin";

const App: React.FC = () => {
  const [tab, setTab] = useState<"pkg" | "role">("pkg");
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 text-slate-900">
      <div className="p-4">
        <div className="inline-flex gap-2 bg-white rounded shadow-sm p-1">
          <button
            className={`px-3 py-1 rounded text-sm ${
              tab === "pkg" ? "bg-green-600 text-white" : "hover:bg-gray-100"
            }`}
            onClick={() => setTab("pkg")}
          >
            Package ↔ Feature
          </button>
          <button
            className={`px-3 py-1 rounded text-sm ${
              tab === "role" ? "bg-green-600 text-white" : "hover:bg-gray-100"
            }`}
            onClick={() => setTab("role")}
          >
            Role ↔ Feature × Action
          </button>
        </div>
      </div>
      {tab === "pkg" ? <PackageFeatureAdmin /> : <RoleFeaturePermissionAdmin />}
    </div>
  );
};

export default App;
