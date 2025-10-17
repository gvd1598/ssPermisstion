import React, { useEffect, useMemo, useState } from "react";
import {
    createEmptyRole,
    createEmptyPermissionAction,
    createEmptyMenu,
} from "../types/domain";
import type {
    RoleEntity,
    PermissionActionEntity,
    FeatureEntity,
    MenuEntity,
} from "../types/domain";
import featuresData from "../data/features.json";
import menusData from "../data/menus.json";
import permissionActionsData from "../data/permission-actions.json";
import CrudList from "./CrudList";

// Mapping shape (new): roleId -> featureId -> menuId -> Set(permissionActionId)
type RoleFeatureMenuActionMap = Record<
    string,
    Record<string, Record<string, Set<string>>>
>;

const LS_KEY = "role-feature-permission-admin-v1"; // keep same key, migrate old shape on load

const defaultRoles: RoleEntity[] = [
    { ...createEmptyRole(1), id: 1, name: "Admin", isSystem: true },
    { ...createEmptyRole(2), id: 2, name: "User", isSystem: false },
];

const defaultPermActions: PermissionActionEntity[] = (
    permissionActionsData as PermissionActionEntity[]
).map((p) => ({ ...p }));

const defaultFeatures: FeatureEntity[] = (featuresData as FeatureEntity[]).map(
    (f) => ({ ...f })
);

function toPersistRFMA(map: RoleFeatureMenuActionMap) {
    const out: Record<string, Record<string, Record<string, string[]>>> = {};
    Object.entries(map).forEach(([rid, byFeature]) => {
        out[rid] = {};
        Object.entries(byFeature).forEach(([fid, byMenu]) => {
            out[rid][fid] = {};
            Object.entries(byMenu).forEach(([mid, set]) => {
                out[rid][fid][mid] = Array.from(set);
            });
        });
    });
    return out;
}

function fromPersistRFMA(raw: unknown): RoleFeatureMenuActionMap {
    const out: RoleFeatureMenuActionMap = {};
    if (!raw || typeof raw !== "object") return out;
    const byRole = raw as Record<string, unknown>;
    Object.entries(byRole).forEach(([rid, byFeature]) => {
        out[rid] = {};
        if (!byFeature || typeof byFeature !== "object") return;
        const byFeatureObj = byFeature as Record<string, unknown>;
        Object.entries(byFeatureObj).forEach(([fid, menusOrArray]) => {
            // Old shape: array of action ids directly under feature
            if (Array.isArray(menusOrArray)) {
                out[rid][fid] = { ["-1"]: new Set(menusOrArray.map((x) => String(x))) };
                return;
            }
            // New shape: object of menuId -> array of action ids
            if (menusOrArray && typeof menusOrArray === "object") {
                const byMenuObj = menusOrArray as Record<string, unknown>;
                out[rid][fid] = {};
                Object.entries(byMenuObj).forEach(([mid, arr]) => {
                    if (Array.isArray(arr)) {
                        out[rid][fid][mid] = new Set(arr.map((x) => String(x)));
                    }
                });
            }
        });
    });
    return out;
}

const RoleFeaturePermissionAdmin: React.FC = () => {
    const [roles, setRoles] = useState<RoleEntity[]>(defaultRoles);
    const [perms, setPerms] =
        useState<PermissionActionEntity[]>(defaultPermActions);
    const [features] = useState<FeatureEntity[]>(defaultFeatures);
    const [menus, setMenus] = useState<MenuEntity[]>(() => {
        try {
            const raw = (menusData as MenuEntity[]) || [];
            return raw.map((m) => ({ ...m }));
        } catch {
            return [createEmptyMenu(1)];
        }
    });
    const [search, setSearch] = useState<string>("");
    const [menuSearch, setMenuSearch] = useState<string>("");
    const [mapping, setMapping] = useState<RoleFeatureMenuActionMap>(() => {
        const ls = localStorage.getItem(LS_KEY);
        if (ls) {
            try {
                const parsed = JSON.parse(ls);
                return fromPersistRFMA(parsed);
            } catch (e) {
                console.warn("Failed parse role-feature-permission", e);
            }
        }
        const init: RoleFeatureMenuActionMap = {};
        roles.forEach((r) => (init[String(r.id)] = {}));
        return init;
    });

    // drag state
    const [draggingFeatureId, setDraggingFeatureId] = useState<string | null>(
        null
    );
    const [droppedRoleId, setDroppedRoleId] = useState<string | null>(null);

    // ensure roles keys
    useEffect(() => {
        setMapping((prev) => {
            const next: RoleFeatureMenuActionMap = { ...prev };
            roles.forEach((r) => {
                next[String(r.id)] ??= {};
            });
            Object.keys(next).forEach((rid) => {
                if (!roles.some((r) => String(r.id) === rid)) delete next[rid];
            });
            return next;
        });
    }, [roles]);

    // persist
    useEffect(() => {
        localStorage.setItem(LS_KEY, JSON.stringify(toPersistRFMA(mapping)));
    }, [mapping, roles, perms]);

    const filteredFeatures = useMemo(() => {
        if (!search) return features;
        const s = search.toLowerCase();
        return features.filter(
            (f) => f.name.toLowerCase().includes(s) || String(f.id).includes(s)
        );
    }, [search, features]);

    const filteredMenus = useMemo(() => {
        if (!menuSearch) return menus;
        const s = menuSearch.toLowerCase();
        return menus.filter(
            (m) =>
                (m.name && m.name.toLowerCase().includes(s)) ||
                (m.path && m.path.toLowerCase().includes(s)) ||
                String(m.id).includes(s)
        );
    }, [menuSearch, menus]);

    const cloneMapping = (
        m: RoleFeatureMenuActionMap
    ): RoleFeatureMenuActionMap => {
        const out: RoleFeatureMenuActionMap = {};
        Object.entries(m).forEach(([rid, byFeature]) => {
            out[rid] = {};
            Object.entries(byFeature).forEach(([fid, byMenu]) => {
                out[rid][fid] = {};
                Object.entries(byMenu).forEach(([mid, set]) => {
                    out[rid][fid][mid] = new Set(Array.from(set));
                });
            });
        });
        return out;
    };

    const handleRoleBeforeSave = ({
                                      draft,
                                      editingId,
                                  }: {
        draft: RoleEntity;
        editingId: number;
    }) => {
        if (editingId === -1) return;
        if (draft.id === editingId) return;
        setMapping((prev) => {
            const oldKey = String(editingId);
            const newKey = String(draft.id);
            if (oldKey === newKey) return prev;
            const next = cloneMapping(prev);
            const oldEntry = next[oldKey];
            if (!oldEntry) {
                next[newKey] ??= {};
                return next;
            }
            const newEntry = next[newKey];
            if (newEntry) {
                Object.entries(oldEntry).forEach(([fid, byMenu]) => {
                    newEntry[fid] ??= {};
                    Object.entries(byMenu).forEach(([mid, set]) => {
                        const existing = newEntry[fid][mid] ?? new Set<string>();
                        set.forEach((val) => existing.add(val));
                        newEntry[fid][mid] = existing;
                    });
                });
            } else {
                next[newKey] = oldEntry;
            }
            delete next[oldKey];
            return next;
        });
    };

    const toggle = (
        roleId: number,
        featureId: number,
        menuId: number | string,
        permId: number
    ) => {
        setMapping((prev) => {
            const next = cloneMapping(prev);
            const rid = String(roleId);
            const fid = String(featureId);
            const mid = String(menuId);
            next[rid] ??= {};
            next[rid][fid] ??= {};
            const existing = next[rid][fid][mid];
            const set = existing ? new Set(Array.from(existing)) : new Set<string>();
            const key = String(permId);
            if (set.has(key)) set.delete(key);
            else set.add(key);
            next[rid][fid][mid] = set;
            return next;
        });
    };

    const removeFeatureFromRole = (roleId: number, featureId: number) => {
        setMapping((prev) => {
            const next = cloneMapping(prev);
            const rid = String(roleId);
            const fid = String(featureId);
            if (next[rid]) {
                delete next[rid][fid];
            }
            return next;
        });
    };

    const removeMenuFromFeature = (
        roleId: number,
        featureId: number,
        menuId: number | string
    ) => {
        setMapping((prev) => {
            const next = cloneMapping(prev);
            const rid = String(roleId);
            const fid = String(featureId);
            const mid = String(menuId);
            if (next[rid]?.[fid]?.[mid]) {
                delete next[rid][fid][mid];
            }
            return next;
        });
    };

    const clearRole = (roleId: number) => {
        setMapping((prev) => {
            const next = cloneMapping(prev);
            next[String(roleId)] = {};
            return next;
        });
    };

    // dnd handlers
    const handleFeatureDragStart =
        (featureId: string | number) => (e: React.DragEvent) => {
            const idStr = String(featureId);
            e.dataTransfer.setData("text/feature-id", idStr);
            setDraggingFeatureId(idStr);
        };

    // menu drag handlers
    const handleMenuDragStart =
        (menuId: string | number) => (e: React.DragEvent) => {
            const idStr = String(menuId);
            e.dataTransfer.setData("text/menu-id", idStr);
            setDraggingFeatureId(idStr);
        };

    const handleFeatureDragEnd = () => setDraggingFeatureId(null);

    const handleRoleDragOver = () => (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };

    const handleRoleDrop = (roleId: string | number) => (e: React.DragEvent) => {
        e.preventDefault();
        const featureId = e.dataTransfer.getData("text/feature-id");
        if (featureId) {
            setMapping((prev) => {
                const next = cloneMapping(prev);
                const rid = String(roleId);
                next[rid] ??= {};
                next[rid][String(featureId)] ??= {};
                return next;
            });
        } else {
            return;
        }
        setDraggingFeatureId(null);
        const rid = String(roleId);
        setDroppedRoleId(rid);
        setTimeout(() => setDroppedRoleId(null), 800);
    };

    const handleFeatureMenuDragOver = () => (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };

    const handleFeatureMenuDrop =
        (roleId: string | number, featureId: string | number) =>
            (e: React.DragEvent) => {
                e.preventDefault();
                const menuId = e.dataTransfer.getData("text/menu-id");
                if (!menuId) return;
                setMapping((prev) => {
                    const next = cloneMapping(prev);
                    const rid = String(roleId);
                    const fid = String(featureId);
                    next[rid] ??= {};
                    next[rid][fid] ??= {};
                    next[rid][fid][String(menuId)] ??= new Set();
                    return next;
                });
            };

    // import CSV
    const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target?.result as string;
                const lines = text.split(/\r?\n/).filter((l) => l.trim());
                if (lines.length < 2) {
                    alert("CSV file is empty or invalid");
                    return;
                }

                // Parse CSV (simple parser supporting quoted fields)
                const parseLine = (line: string): string[] => {
                    const result: string[] = [];
                    let current = "";
                    let inQuotes = false;
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"') {
                            if (inQuotes && line[i + 1] === '"') {
                                current += '"';
                                i++;
                            } else {
                                inQuotes = !inQuotes;
                            }
                        } else if (char === "," && !inQuotes) {
                            result.push(current);
                            current = "";
                        } else {
                            current += char;
                        }
                    }
                    result.push(current);
                    return result;
                };

                // Skip header row
                lines.shift();
                const newMapping: RoleFeatureMenuActionMap = {};

                for (let i = 0; i < lines.length; i++) {
                    const cols = parseLine(lines[i]);
                    if (cols.length < 7) continue; // need at least role_id, feature_id, menu_id, permission_action_id

                    const roleId = cols[0]?.trim();
                    const featureId = cols[2]?.trim();
                    const menuId = cols[4]?.trim();
                    const permId = cols[6]?.trim();

                    if (!roleId || !featureId || !menuId || !permId) continue;

                    newMapping[roleId] ??= {};
                    newMapping[roleId][featureId] ??= {};
                    newMapping[roleId][featureId][menuId] ??= new Set();
                    newMapping[roleId][featureId][menuId].add(permId);
                }

                setMapping(newMapping);
                alert(`CSV imported successfully! Loaded ${lines.length - 1} rows.`);
            } catch (err) {
                console.error("CSV import error:", err);
                alert("Failed to import CSV. Please check the file format.");
            }
        };
        reader.readAsText(file);
        e.target.value = ""; // reset input
    };

    // export CSV: role_id,role_name,feature_id,feature_name,menu_id,menu_name,permission_action_id,permission_action_name,permission_action_code,createdAt,updatedAt,createdBy,updatedBy
    const exportCSV = () => {
        const rows: string[] = [];
        rows.push(
            "role_id,role_name,feature_id,feature_name,menu_id,menu_name,permission_action_id,permission_action_name,permission_action_code,createdAt,updatedAt,createdBy,updatedBy"
        );
        const now = String(Date.now());
        const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
        Object.entries(mapping).forEach(([rid, byFeature]) => {
            const role = roles.find((r) => String(r.id) === rid);
            Object.entries(byFeature).forEach(([fid, byMenu]) => {
                const feature = features.find((f) => String(f.id) === fid);
                Object.entries(byMenu).forEach(([mid, set]) => {
                    const menu = menus.find((m) => String(m.id) === mid);
                    if (!set || set.size === 0) return;
                    Array.from(set).forEach((pid) => {
                        const pa = perms.find((p) => String(p.id) === pid);
                        rows.push(
                            [
                                esc(rid),
                                esc(role?.name ?? ""),
                                esc(fid),
                                esc(feature?.name ?? ""),
                                esc(mid),
                                esc(menu?.name ?? ""),
                                esc(pid),
                                esc(pa?.name ?? ""),
                                esc(pa?.code ?? ""),
                                esc(now),
                                esc(now),
                                esc("system"),
                                esc("system"),
                            ].join(",")
                        );
                    });
                });
            });
        });
        const csv = rows.join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "role-feature-permissions.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-6 p-4">
            <div className="toolbar">
                <div style={{ flex: 1 }}>
                    <h1 className="text-xl font-semibold">
                        Role / Feature / Menu / Action
                    </h1>
                    <div className="text-sm muted">
                        กำหนดสิทธิ์ของ role ▶ feature ▶ menu ▶ action
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                        className="search"
                        placeholder="Search features..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <label
                        className="btn-ghost px-3 py-2 rounded text-sm cursor-pointer"
                        title="Import CSV"
                    >
                        <input
                            type="file"
                            accept=".csv"
                            onChange={importCSV}
                            style={{ display: "none" }}
                        />
                        Import CSV
                    </label>
                    <button
                        onClick={exportCSV}
                        className="btn-ghost px-3 py-2 rounded text-sm"
                        title="Export CSV"
                    >
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)_300px] lg:grid-cols-[300px_minmax(0,1fr)_340px] gap-6">
                {/* Left: draggable features + role/actions editors */}
                <div className="space-y-6 card p-4">
                    <CrudList
                        title="Roles"
                        items={roles}
                        setItems={setRoles}
                        createItem={createEmptyRole}
                        fields={[
                            { name: "id", label: "ID", required: true, type: "number" },
                            { name: "name", label: "Name", required: true },
                        ]}
                        itemLabel={(r) => `${r.id} - ${r.name}`}
                        onBeforeSave={handleRoleBeforeSave}
                    />
                    <CrudList
                        title="Actions"
                        items={perms}
                        setItems={setPerms}
                        createItem={createEmptyPermissionAction}
                        fields={[
                            { name: "name", label: "Name", required: true },
                            { name: "code", label: "Code", required: true },
                        ]}
                        itemLabel={(p) => `${p.name} (${p.code})`}
                    />
                    <CrudList
                        title="Menus"
                        items={menus}
                        setItems={setMenus}
                        createItem={createEmptyMenu}
                        fields={[
                            { name: "name", label: "Name", required: true },
                            { name: "path", label: "Path", required: true },
                        ]}
                        itemLabel={(m) => `${m.name} (${m.path})`}
                    />
                    {/* Features list removed from left column - moved to right palette */}
                </div>

                <div className="card p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {roles.map((r) => {
                            const roleId = String(r.id);
                            const featureIds = Object.keys(mapping[roleId] ?? {});
                            return (
                                <div
                                    key={r.id}
                                    onDragOver={handleRoleDragOver()}
                                    onDrop={handleRoleDrop(r.id)}
                                    className={`border rounded-lg p-12 bg-white card flex flex-col gap-2 min-h-48 relative max-h-[80vh] overflow-y-auto ${
                                        roleId === droppedRoleId
                                            ? "ring-2 ring-[rgba(16,185,129,0.24)]"
                                            : ""
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-medium leading-tight flex items-center gap-2">
                                                    <div className="w-7 h-7 bg-green-100 text-green-700 rounded flex items-center justify-center text-sm font-semibold">
                                                        {String(r.name).charAt(0)}
                                                    </div>
                                                    {r.name}
                                                </h3>
                                                <span className="text-[12px] bg-green-50 text-green-700 rounded-full px-2 py-0.5 border border-[rgba(16,185,129,0.08)]">
                          {featureIds.length}
                        </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => clearRole(r.id)}
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
                                        {featureIds.length === 0 && (
                                            <div className="text-xs text-gray-400 italic select-none">
                                                Drag features here
                                            </div>
                                        )}
                                        {featureIds.map((fid) => {
                                            const feat = features.find((f) => String(f.id) === fid);
                                            if (!feat) return null;
                                            const menuIds = Object.keys(mapping[roleId]?.[fid] ?? {});
                                            return (
                                                <div
                                                    key={`${r.id}-${fid}`}
                                                    className="group flex flex-col gap-2 text-xs bg-white border rounded px-2 py-2 shadow-sm"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
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
                                                            className="opacity-40 hover:opacity-100 transition text-gray-400 hover:text-red-600"
                                                            onClick={() =>
                                                                removeFeatureFromRole(r.id, Number(fid))
                                                            }
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
                                                    {/* Menu drop zone within feature */}
                                                    <div
                                                        className="rounded border border-dashed p-2 bg-white/70"
                                                        onDragOver={handleFeatureMenuDragOver()}
                                                        onDrop={handleFeatureMenuDrop(r.id, Number(fid))}
                                                    >
                                                        {menuIds.length === 0 && (
                                                            <div className="text-[11px] text-gray-400 italic">
                                                                ลากเมนูมาปล่อยที่นี่
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col gap-2">
                                                            {menuIds.map((mid) => {
                                                                const menu = menus.find(
                                                                    (m) => String(m.id) === mid
                                                                );
                                                                return (
                                                                    <div
                                                                        key={`${fid}-${mid}`}
                                                                        className="border rounded p-2 bg-white"
                                                                    >
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className="font-medium text-[11px] text-gray-700">
                                                                                {menu?.name ||
                                                                                    menu?.path ||
                                                                                    `menu-${mid}`}
                                                                            </div>
                                                                            <button
                                                                                className="opacity-40 hover:opacity-100 transition text-gray-400 hover:text-red-600"
                                                                                title="Remove menu"
                                                                                onClick={() =>
                                                                                    removeMenuFromFeature(
                                                                                        r.id,
                                                                                        Number(fid),
                                                                                        mid
                                                                                    )
                                                                                }
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
                                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                                            {perms.map((p) => {
                                                                                const checked = mapping[roleId]?.[
                                                                                    fid
                                                                                    ]?.[mid]?.has(String(p.id));
                                                                                return (
                                                                                    <label
                                                                                        key={`${fid}-${mid}-${p.id}`}
                                                                                        className="inline-flex items-center gap-1 text-xs"
                                                                                    >
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={!!checked}
                                                                                            onChange={() =>
                                                                                                toggle(
                                                                                                    r.id,
                                                                                                    Number(fid),
                                                                                                    mid,
                                                                                                    p.id
                                                                                                )
                                                                                            }
                                                                                        />
                                                                                        <span>
                                              {p.name}{" "}
                                                                                            <span className="text-[10px] text-gray-500">
                                                ({p.code})
                                              </span>
                                            </span>
                                                                                    </label>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {/* Right: Features (top) + Menus (below) palette */}
                <div>
                    <div className="card p-3 md:sticky md:top-4 self-start">
                        <h2 className="font-medium mb-2 text-sm text-slate-700">
                            Features
                        </h2>
                        <input
                            className="w-full border rounded px-2 py-1 text-sm mb-2"
                            placeholder="ค้นหา features..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <ul className="space-y-2 max-h-[34vh] overflow-auto pr-1 mb-3">
                            {filteredFeatures.map((f) => {
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
                                    </li>
                                );
                            })}
                        </ul>

                        <h2 className="font-medium mb-2 text-sm text-slate-700">
                            Menus (ลากไปปล่อยใน Feature)
                        </h2>
                        <input
                            className="w-full border rounded px-2 py-1 text-sm mb-2"
                            placeholder="ค้นหาเมนู..."
                            value={menuSearch}
                            onChange={(e) => setMenuSearch(e.target.value)}
                        />
                        <ul className="space-y-2 max-h-[34vh] overflow-auto pr-1">
                            {filteredMenus.map((m) => (
                                <li
                                    key={m.id}
                                    draggable
                                    onDragStart={handleMenuDragStart(m.id)}
                                    onDragEnd={handleFeatureDragEnd}
                                    className={`border rounded px-3 py-2 bg-white shadow-sm cursor-grab active:cursor-grabbing transition text-sm flex items-center gap-3 hover:border-[rgba(22,163,74,0.6)]`}
                                >
                                    <div className="flex-1 text-sm">
                                        <div className="font-medium">
                                            {m.name || `menu-${m.id}`}
                                        </div>
                                        {m.path && (
                                            <div className="text-[11px] text-gray-500">{m.path}</div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoleFeaturePermissionAdmin;
