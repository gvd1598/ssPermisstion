import React, { useCallback, useMemo, useState } from "react";

// Types
export interface Feature {
  id: string | number;
  name: string;
  description?: string;
}

export interface PackageItem {
  id: string | number;
  name: string;
  description?: string;
}

// Mapping shape: packageId -> Set of featureIds
export type PackageFeatureMap = Record<string, Set<string>>; // internal keys always string

interface PackageFeatureMapperProps {
  initialPackages?: PackageItem[];
  initialFeatures?: Feature[];
  value?: PackageFeatureMap; // controlled (optional)
  onChange?: (map: PackageFeatureMap) => void;
}

const samplePackages: PackageItem[] = [
  { id: "pkg-core", name: "Core", description: "Core base permissions" },
  { id: "pkg-analytics", name: "Analytics", description: "Reporting & BI" },
  { id: "pkg-admin", name: "Admin", description: "Administration tools" },
];

const sampleFeatures: Feature[] = [
  { id: "feat-read", name: "Read", description: "Read data" },
  { id: "feat-write", name: "Write", description: "Create / update data" },
  { id: "feat-delete", name: "Delete", description: "Remove records" },
  { id: "feat-export", name: "Export", description: "Export to CSV" },
  { id: "feat-dashboard", name: "Dashboard", description: "View dashboards" },
];

// Utility to clone map
function cloneMap(map: PackageFeatureMap): PackageFeatureMap {
  const next: PackageFeatureMap = {};
  Object.entries(map).forEach(([k, v]) => (next[k] = new Set(v)));
  return next;
}

const PackageFeatureMapper: React.FC<PackageFeatureMapperProps> = ({
  initialPackages = samplePackages,
  initialFeatures = sampleFeatures,
  value,
  onChange,
}) => {
  const uncontrolled = useState<PackageFeatureMap>(() => {
    const init: PackageFeatureMap = {};
    initialPackages.forEach((p) => (init[String(p.id)] = new Set()));
    return init;
  });
  const [internalMap, setInternalMap] = uncontrolled;
  const map = value ?? internalMap;

  const setMap = useCallback(
    (updater: (prev: PackageFeatureMap) => PackageFeatureMap) => {
      if (value) {
        const next = updater(cloneMap(value));
        onChange?.(next);
      } else {
        setInternalMap((prev) => {
          const next = updater(prev);
          // Fire callback with cloned to avoid external mutation
          onChange?.(cloneMap(next));
          return next;
        });
      }
    },
    [value, setInternalMap, onChange]
  );

  // mapping is available via `map` variable

  // Drag state
  const [draggingFeatureId, setDraggingFeatureId] = useState<string | null>(
    null
  );

  const [droppedPackageId, setDroppedPackageId] = useState<string | null>(null);

  // reverse lookup: featureId -> packages that contain it
  const featureToPackages = useMemo(() => {
    const m: Record<string, PackageItem[]> = {};
    Object.entries(map).forEach(([pkgId, set]) => {
      const pkg = initialPackages.find((p) => String(p.id) === pkgId);
      if (!pkg) return;
      Array.from(set).forEach((fid) => {
        m[fid] ??= [];
        m[fid].push(pkg);
      });
    });
    return m;
  }, [map, initialPackages]);

  const handleFeatureDragStart =
    (featureId: string | number) => (e: React.DragEvent) => {
      const idStr = String(featureId);
      e.dataTransfer.setData("text/feature-id", idStr);
      setDraggingFeatureId(idStr);
    };

  const handleFeatureDragEnd = () => setDraggingFeatureId(null);

  const handlePackageDragOver = () => (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
    e.dataTransfer.dropEffect = "copy";
  };

  const handlePackageDrop =
    (pkgId: string | number) => (e: React.DragEvent) => {
      e.preventDefault();
      const featureId = e.dataTransfer.getData("text/feature-id");
      if (!featureId) return;
      setMap((prev) => {
        const next = cloneMap(prev);
        const k = String(pkgId);
        next[k] ??= new Set();
        next[k].add(featureId);
        return next;
      });
      setDraggingFeatureId(null);
      const k = String(pkgId);
      setDroppedPackageId(k);
      setTimeout(() => setDroppedPackageId(null), 800);
    };

  const removeMapping = (pkgId: string | number, featureId: string) => {
    setMap((prev) => {
      const next = cloneMap(prev);
      next[String(pkgId)]?.delete(featureId);
      return next;
    });
  };

  const clearPackage = (pkgId: string | number) => {
    setMap((prev) => {
      const next = cloneMap(prev);
      next[String(pkgId)] = new Set();
      return next;
    });
  };

  // JSON export/copy removed — PackageFeatureAdmin handles CSV import/export

  return (
    <div className="flex flex-col gap-6 p-2">
      <div className="card p-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-800">
          Package ⇄ Feature Mapping
        </h1>
        <div className="text-sm muted">
          Drag features to packages to build your mapping
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Features list */}
        <div className="md:col-span-1">
          <h2 className="font-medium mb-2 text-sm text-slate-700">Features</h2>
          <ul className="space-y-2 max-h-[60vh] overflow-auto pr-1">
            {initialFeatures.map((f) => {
              const isDragging = draggingFeatureId === String(f.id);
              return (
                <li
                  key={f.id}
                  draggable
                  onDragStart={handleFeatureDragStart(f.id)}
                  onDragEnd={handleFeatureDragEnd}
                  className={`border rounded px-3 py-2 bg-white shadow-sm cursor-grab active:cursor-grabbing transition text-sm flex items-center gap-3 ${
                    isDragging
                      ? "opacity-60 border-[rgba(22,163,74,0.4)]"
                      : "hover:border-[rgba(22,163,74,0.6)]"
                  }`}
                >
                  <div className="w-8 h-8 bg-green-100 text-green-700 rounded flex items-center justify-center text-sm font-semibold">
                    {String(f.name).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <span className="font-medium">{f.name}</span>
                    {f.description && (
                      <div className="text-xs text-gray-500 line-clamp-2">
                        {f.description}
                      </div>
                    )}
                  </div>
                  {/* badge: show how many packages this feature is assigned to */}
                  <div className="flex items-center gap-2">
                    {featureToPackages[String(f.id)] && (
                      <div
                        className="text-[11px] bg-green-50 text-green-700 rounded-full px-2 py-0.5 border border-[rgba(16,185,129,0.12)]"
                        title={featureToPackages[String(f.id)]
                          .map((p) => p.name)
                          .join(", ")}
                      >
                        {featureToPackages[String(f.id)].length}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        {/* Packages */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialPackages.map((p) => {
            const features = Array.from(map[String(p.id)] ?? []);
            return (
              <div
                key={p.id}
                onDragOver={handlePackageDragOver()}
                onDrop={handlePackageDrop(p.id)}
                className={`border rounded-lg p-3 bg-white card flex flex-col gap-2 min-h-48 relative max-h-[80vh] overflow-y-auto ${
                  String(p.id) === droppedPackageId
                    ? "ring-2 ring-[rgba(16,185,129,0.24)]"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium leading-tight flex items-center gap-2">
                        <div className="w-7 h-7 bg-green-100 text-green-700 rounded flex items-center justify-center text-sm font-semibold">
                          {String(p.name).charAt(0)}
                        </div>
                        {p.name}
                      </h3>
                      <span className="text-[12px] bg-green-50 text-green-700 rounded-full px-2 py-0.5 border border-[rgba(16,185,129,0.08)]">
                        {features.length}
                      </span>
                    </div>
                    {p.description && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {p.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => clearPackage(p.id)}
                      className="btn-ghost px-2 py-1 rounded flex items-center gap-2"
                      title="Clear all features"
                    >
                      <svg
                        className="icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div
                  className={`flex-1 flex flex-col gap-2 rounded border border-dashed p-2 transition bg-white/60 overflow-y-auto ${
                    draggingFeatureId
                      ? "border-[rgba(16,185,129,0.6)]"
                      : "border-[rgba(148,163,184,0.16)]"
                  }`}
                >
                  {features.length === 0 && (
                    <div className="text-xs text-gray-400 italic select-none">
                      Drag features here
                    </div>
                  )}
                  {features.map((fid) => {
                    const feat = initialFeatures.find(
                      (f) => String(f.id) === fid
                    );
                    if (!feat) return null;
                    return (
                      <div
                        key={fid}
                        className="group flex items-start justify-between gap-2 text-xs bg-white border rounded px-2 py-1 shadow-sm"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-800 text-[11px] leading-tight">
                            {feat.name}
                          </div>
                          {feat.description && (
                            <div className="text-[10px] text-gray-500 line-clamp-2">
                              {feat.description}
                            </div>
                          )}
                        </div>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition text-gray-400 hover:text-red-600"
                          onClick={() => removeMapping(p.id, fid)}
                          title="Remove feature"
                        >
                          <svg
                            className="icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M6 6l12 12M18 6L6 18"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid md:grid-cols-1 gap-6">
        <div className="text-xs text-gray-600 space-y-2">
          <h2 className="font-medium">How to use</h2>
          <ol className="list-decimal ml-4 space-y-1">
            <li>ลาก (drag) ฟีเจอร์จากคอลัมน์ซ้ายไปยังแพ็คเกจที่ต้องการ</li>
            <li>กด Clear เพื่อล้างฟีเจอร์ของแพ็คเกจ</li>
            <li>
              ใช้ปุ่ม Export CSV / Load CSV ในหน้า admin เพื่อนำเข้า-ส่งออก
              mapping
            </li>
            <li>คุณสามารถแก้ไขโค้ดเพื่อดึงข้อมูลจริงจาก API ได้</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default PackageFeatureMapper;
