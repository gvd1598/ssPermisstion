import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

  // JSON export removed; CSV-only behavior

  const exportCSV = () => {
    // columns: package_id,package_name,feature_id,feature_name,createdAt,updatedAt,createdBy,updatedBy
    // createdAt/updatedAt are mapping-level timestamps (epoch ms), createdBy/updatedBy set to "system"
    const rows: string[] = [];
    rows.push(
      "package_id,package_name,feature_id,feature_name,createdAt,updatedAt,createdBy,updatedBy"
    );
    const now = String(Date.now()); // epoch ms
    Object.entries(toPersist(mapping)).forEach(([pkgId, featIds]) => {
      const pkg = packages.find((p) => String(p.id) === pkgId);
      featIds.forEach((fid) => {
        const feat = features.find((f) => String(f.id) === fid);
        const cols = [
          pkgId,
          pkg?.name ?? "",
          fid,
          feat?.name ?? "",
          now,
          now,
          "system",
          "system",
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

  // --- CSV load / import ---
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function parseCSV(text: string): Record<string, string>[] {
    // simple RFC4180-ish parser returning array of row objects keyed by header
    const lines = text.split(/\r?\n/);
    // drop empty lines
    const filtered = lines.filter((l) => l.trim() !== "");
    if (filtered.length === 0) return [];

    const parseLine = (line: string) => {
      const cells: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === "," && !inQuotes) {
          cells.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
      cells.push(cur);
      return cells.map((c) => c.trim());
    };

    const headers = parseLine(filtered[0]).map((h) => h.trim());
    return filtered.slice(1).map((ln) => {
      const cells = parseLine(ln);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => (obj[h] = cells[i] ?? ""));
      return obj;
    });
  }

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = parseCSV(text);
        if (!parsed.length) {
          alert("No rows found in CSV");
          return;
        }

        // Build lookup maps from current state (mutable)
        const pkgMap = new Map<string, PackageEntity>(
          packages.map((p) => [String(p.id), p])
        );
        const featMap = new Map<string, FeatureEntity | FeatureEntity>(
          features.map((f) => [String(f.id), f])
        );
        const newPersist: Record<string, string[]> = {};

        parsed.forEach((row) => {
          // normalize keys
          const normRow: Record<string, string> = {};
          Object.entries(row).forEach(([k, v]) => {
            normRow[normalize(k)] = v;
          });

          const pkgIdRaw = normRow["packageid"] ?? normRow["package_id"] ?? "";
          const pkgId = String(pkgIdRaw).trim();
          if (!pkgId) return;

          const pkgName = normRow["packagename"] ?? "";
          const pkgCreatedAt = normRow["packagecreatedat"] ?? "";
          const pkgUpdatedAt = normRow["packageupdatedat"] ?? "";

          const featIdRaw = normRow["featureid"] ?? normRow["feature_id"] ?? "";
          const featId = String(featIdRaw).trim();
          if (!featId) return;

          const featName = normRow["featurename"] ?? "";
          const featCode = normRow["featurecode"] ?? "";
          const featCreatedAt = normRow["featurecreatedat"] ?? "";
          const featUpdatedAt = normRow["featureupdatedat"] ?? "";

          // upsert package
          if (!pkgMap.has(pkgId)) {
            const idNum = Number(pkgId);
            const created = createEmptyPackage(
              isNaN(idNum) ? nextIdFor(packages) : idNum
            );
            const newPkg: PackageEntity = {
              ...created,
              id: isNaN(idNum) ? created.id : idNum,
              name: pkgName || created.name,
              createdAt: pkgCreatedAt || created.createdAt,
              updatedAt: pkgUpdatedAt || created.updatedAt,
              code: created.code,
            };
            pkgMap.set(String(newPkg.id), newPkg);
          } else {
            const existing = pkgMap.get(pkgId)!;
            if (pkgName) existing.name = pkgName;
            if (pkgCreatedAt) existing.createdAt = pkgCreatedAt;
            if (pkgUpdatedAt) existing.updatedAt = pkgUpdatedAt;
            pkgMap.set(pkgId, existing);
          }

          // upsert feature
          if (!featMap.has(featId)) {
            const idNum = Number(featId);
            const created = createEmptyFeature(
              isNaN(idNum) ? nextIdFor(features) : idNum
            );
            const newFeat: FeatureEntity = {
              ...created,
              id: isNaN(idNum) ? created.id : idNum,
              name: featName || created.name,
              code: featCode || created.code,
              createdAt: featCreatedAt || created.createdAt,
              updatedAt: featUpdatedAt || created.updatedAt,
            };
            featMap.set(String(newFeat.id), newFeat);
          } else {
            const existing = featMap.get(featId)! as FeatureEntity;
            if (featName) existing.name = featName;
            if (featCode) existing.code = featCode;
            if (featCreatedAt) existing.createdAt = featCreatedAt;
            if (featUpdatedAt) existing.updatedAt = featUpdatedAt;
            featMap.set(featId, existing);
          }

          // mapping
          newPersist[pkgId] ??= [];
          if (!newPersist[pkgId].includes(featId))
            newPersist[pkgId].push(featId);
        });

        // Replace state
        setPackages(Array.from(pkgMap.values()).sort((a, b) => a.id - b.id));
        setFeatures(Array.from(featMap.values()).sort((a, b) => a.id - b.id));
        setMapping(fromPersist(newPersist));
        alert(
          `Loaded ${Object.keys(newPersist).length} package mappings from CSV`
        );
      } catch (err) {
        console.error(err);
        alert("Failed to parse CSV file");
      } finally {
        // reset input so same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(f, "utf-8");
  };

  // helper to generate a nextId when CSV contains non-numeric id
  const nextIdFor = (arr: { id: number }[]) =>
    arr.length ? Math.max(...arr.map((x) => x.id)) + 1 : 1;

  // removed: copyAll JSON function — CSV-only import/export now

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
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary px-3 py-2 rounded text-sm"
            title="Load CSV mapping"
            aria-label="Load mappings from CSV"
          >
            Load CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            style={{ display: "none" }}
            aria-hidden
          />
          <button
            onClick={exportCSV}
            className="btn-ghost px-3 py-2 rounded text-sm"
            title="Export CSV mapping"
            aria-label="Export mappings to CSV"
          >
            Export CSV
          </button>
          {/* CSV-only: Load / Export CSV buttons are shown above */}
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
