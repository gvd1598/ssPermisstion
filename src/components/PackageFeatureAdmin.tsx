import React, { useCallback, useEffect, useMemo, useState } from "react";
import CrudList from "./CrudList";
import PackageFeatureMapper from "./PackageFeatureMapper";
import type { PackageFeatureMap } from "./PackageFeatureMapper";
import type { FeatureEntity, PackageEntity } from "../types/domain";
import { createEmptyFeature, createEmptyPackage } from "../types/domain";
import featuresData from "../data/features.json";
import packagesData from "../data/packages.json";

const LS_KEY = "pkg-feature-admin-state-v1";

interface PersistShape {
  packages: PackageEntity[];
  features: FeatureEntity[];
  mapping: Record<string, string[]>; // stringified ids
}

const defaultPackages: PackageEntity[] = (packagesData as PackageEntity[]).map(
  (p) => ({
    ...createEmptyPackage(p.id),
    ...p,
  })
);

const defaultFeatures: FeatureEntity[] = (featuresData as FeatureEntity[]).map(
  (f) => ({
    ...createEmptyFeature(f.id),
    ...f,
  })
);

function toPersist(mapping: PackageFeatureMap): Record<string, string[]> {
  const obj: Record<string, string[]> = {};
  Object.entries(mapping).forEach(([k, set]) => (obj[k] = Array.from(set)));
  return obj;
}

function fromPersist(raw: Record<string, string[]>): PackageFeatureMap {
  const map: PackageFeatureMap = {};
  Object.entries(raw).forEach(([k, arr]) => (map[k] = new Set(arr)));
  return map;
}

const PackageFeatureAdmin: React.FC = () => {
  const [packages, setPackages] = useState<PackageEntity[]>(defaultPackages);
  const [features, setFeatures] = useState<FeatureEntity[]>(defaultFeatures);
  const [search, setSearch] = useState<string>("");
  const [mapping, setMapping] = useState<PackageFeatureMap>(() => {
    const ls = localStorage.getItem(LS_KEY);
    if (ls) {
      try {
        const parsed: PersistShape = JSON.parse(ls);
        return fromPersist(parsed.mapping);
      } catch (e) {
        console.warn("Failed parse mapping", e);
      }
    }
    const init: PackageFeatureMap = {};
    packages.forEach((p) => (init[String(p.id)] = new Set()));
    return init;
  });

  // Ensure mapping has keys for all packages
  useEffect(() => {
    setMapping((prev) => {
      const next: PackageFeatureMap = { ...prev };
      packages.forEach((p) => {
        if (!next[String(p.id)]) next[String(p.id)] = new Set();
      });
      // Remove keys for deleted packages
      Object.keys(next).forEach((k) => {
        if (!packages.some((p) => String(p.id) === k)) delete next[k];
      });
      return next;
    });
  }, [packages]);

  // Persist to localStorage
  useEffect(() => {
    const data: PersistShape = {
      packages,
      features,
      mapping: toPersist(mapping),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  }, [packages, features, mapping]);

  // Clean up mapping when features removed
  useEffect(() => {
    setMapping((prev) => {
      const next: PackageFeatureMap = {};
      Object.entries(prev).forEach(([pkgId, set]) => {
        const filtered = Array.from(set).filter((fid) =>
          features.some((f) => String(f.id) === fid)
        );
        next[pkgId] = new Set(filtered);
      });
      return next;
    });
  }, [features]);

  const mapperFeatures = useMemo(
    () =>
      features.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description ?? undefined,
      })),
    [features]
  );
  const mapperPackages = useMemo(
    () =>
      packages.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? undefined,
      })),
    [packages]
  );

  const filteredMapperFeatures = useMemo(() => {
    if (!search) return mapperFeatures;
    const s = search.toLowerCase();
    return mapperFeatures.filter(
      (f) => f.name.toLowerCase().includes(s) || String(f.id).includes(s)
    );
  }, [mapperFeatures, search]);

  const filteredMapperPackages = useMemo(() => {
    if (!search) return mapperPackages;
    const s = search.toLowerCase();
    return mapperPackages.filter(
      (p) => p.name.toLowerCase().includes(s) || String(p.id).includes(s)
    );
  }, [mapperPackages, search]);

  const onMappingChange = useCallback(
    (m: PackageFeatureMap) => setMapping(m),
    []
  );

  const exportAll = () => {
    const out = {
      packages,
      features,
      mapping: toPersist(mapping),
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "full-package-feature-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    // columns: package_id,package_name,feature_id,feature_name,feature_code
    const rows: string[] = [];
    rows.push("package_id,package_name,feature_id,feature_name,feature_code");
    Object.entries(toPersist(mapping)).forEach(([pkgId, featIds]) => {
      const pkg = packages.find((p) => String(p.id) === pkgId);
      featIds.forEach((fid) => {
        const feat = features.find((f) => String(f.id) === fid);
        const cols = [
          pkgId,
          pkg?.name ?? "",
          fid,
          feat?.name ?? "",
          feat?.code ?? "",
        ];
        // escape commas and quotes
        const esc = cols
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(",");
        rows.push(esc);
      });
    });
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "package-feature-mapping.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAll = async () => {
    try {
      const out = {
        packages,
        features,
        mapping: toPersist(mapping),
      };
      await navigator.clipboard.writeText(JSON.stringify(out, null, 2));
      // lightweight feedback
      alert("Configuration copied to clipboard");
    } catch (e) {
      console.warn("copy failed", e);
      alert("Copy failed — please use Export JSON");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="toolbar">
        <div style={{ flex: 1 }}>
          <h1 className="text-xl font-semibold">Package / Feature Admin</h1>
          <div className="text-sm muted">
            Manage packages, features and mappings
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="search"
            placeholder="Search packages or features..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={exportCSV}
            className="btn-ghost px-3 py-2 rounded"
            title="Export CSV"
          >
            <svg
              className="icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 6h18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 12h18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 18h18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            onClick={exportAll}
            className="btn-primary px-3 py-2 rounded"
            title="Download JSON"
            style={{ color: "white" }}
          >
            <svg
              className="icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 3v12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 11l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="3"
                y="17"
                width="18"
                height="4"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </button>
          <button
            onClick={copyAll}
            className="btn-ghost px-3 py-2 rounded"
            title="Copy JSON to clipboard"
          >
            <svg
              className="icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="9"
                y="9"
                width="11"
                height="11"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <rect
                x="4"
                y="4"
                width="11"
                height="11"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6 card p-4">
          <CrudList
            title="Packages"
            items={packages}
            setItems={setPackages}
            createItem={createEmptyPackage}
            fields={[
              { name: "name", label: "Name", required: true },
              { name: "code", label: "Code", required: true },
              { name: "description", label: "Description", type: "textarea" },
              { name: "price", label: "Price", type: "number" },
              { name: "durationDay", label: "Days", type: "number" },
              { name: "active", label: "Active", type: "checkbox" },
            ]}
            itemLabel={(p) => `${p.name} (${p.code})`}
          />
          <CrudList
            title="Features"
            items={features}
            setItems={setFeatures}
            createItem={createEmptyFeature}
            fields={[
              { name: "name", label: "Name", required: true },
              { name: "code", label: "Code", required: true },
              { name: "description", label: "Description", type: "textarea" },
              { name: "active", label: "Active", type: "checkbox" },
              { name: "isOpen", label: "Is Open", type: "checkbox" },
            ]}
            itemLabel={(f) => `${f.name} (${f.code})`}
          />
        </div>
        <div className="md:col-span-2 card p-4">
          <PackageFeatureMapper
            initialFeatures={filteredMapperFeatures}
            initialPackages={filteredMapperPackages}
            value={mapping}
            onChange={onMappingChange}
          />
        </div>
      </div>
    </div>
  );
};

export default PackageFeatureAdmin;
