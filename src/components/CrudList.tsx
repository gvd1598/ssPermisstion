import React, { useState } from "react";

// Base item: allow arbitrary extra fields via index signature with unknown
export interface BaseItem {
  id: number;
  [key: string]: unknown;
}

interface FieldConfig<T extends BaseItem> {
  name: keyof T & string;
  label: string;
  type?: "text" | "number" | "textarea" | "checkbox";
  placeholder?: string;
  required?: boolean;
  className?: string;
}

interface CrudListProps<T extends BaseItem> {
  title: string;
  items: T[];
  setItems: (items: T[]) => void;
  fields: FieldConfig<T>[];
  createItem: (nextId: number) => T;
  itemLabel?: (item: T) => string;
}

function CrudList<T extends BaseItem>({
  title,
  items,
  setItems,
  fields,
  createItem,
  itemLabel = (i) =>
    (i as Record<string, unknown>).name?.toString() ?? String(i.id),
}: CrudListProps<T>) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<T>>({});

  const startAdd = () => {
    setEditingId(-1);
    setDraft(createItem(nextId()));
  };
  const startEdit = (id: number) => {
    const current = items.find((i) => i.id === id);
    if (!current) return;
    setEditingId(id);
    setDraft({ ...current });
  };
  const cancel = () => {
    setEditingId(null);
    setDraft({});
  };
  const save = () => {
    if (editingId === -1) {
      setItems([...items, draft as T]);
    } else {
      setItems(
        items.map((i) =>
          i.id === editingId ? { ...(draft as T), id: i.id } : i
        )
      );
    }
    cancel();
  };
  const remove = (id: number) => {
    setItems(items.filter((i) => i.id !== id));
    if (editingId === id) cancel();
  };
  const nextId = () =>
    items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1;

  const updateField = (name: string, value: unknown) => {
    setDraft((d) => ({ ...d, [name]: value }));
  };

  return (
    <div className="flex flex-col gap-3 card p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm text-slate-800">{title}</h3>
        {editingId === null && (
          <button
            onClick={startAdd}
            className="btn-primary text-xs px-2 py-1 rounded flex items-center gap-2"
            title={`Add ${title}`}
          >
            <svg
              className="icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[12px]">Add</span>
          </button>
        )}
      </div>
      <ul className="space-y-1 max-h-48 overflow-auto pr-1 text-sm">
        {items.map((it) => (
          <li
            key={it.id}
            className={`flex items-center justify-between gap-2 px-2 py-1 bg-white transition-all hover:shadow-sm ${
              editingId === it.id ? "ring-1 ring-[rgba(22,163,74,0.18)]" : ""
            }`}
          >
            <span className="truncate flex-1 text-sm" title={itemLabel(it)}>
              {itemLabel(it)}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => startEdit(it.id)}
                className="btn-ghost px-2 py-1 rounded flex items-center justify-center"
                title="Edit"
              >
                <svg
                  className="icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 21l3-1 11-11 1-3-3 1L4 17l-1 4z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                onClick={() => remove(it.id)}
                className="px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center"
                title="Delete"
              >
                <svg
                  className="icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6M10 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-xs text-gray-400">No items</li>
        )}
      </ul>
      {editingId !== null && (
        <div className="border rounded p-3 bg-white flex flex-col gap-2 text-xs">
          <div className="font-medium text-sm mb-1">
            {editingId === -1 ? "Add New" : `Edit #${editingId}`}
          </div>
          {fields.map((f) => {
            const val = (draft as Record<string, unknown>)[f.name];
            const displayValue =
              typeof val === "string" || typeof val === "number"
                ? val
                : val == null
                ? ""
                : String(val);
            const common = {
              id: f.name,
              name: f.name,
              className:
                "w-full rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white",
              placeholder: f.placeholder,
              required: f.required,
              value: f.type === "checkbox" ? undefined : displayValue,
              onChange: (
                e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
              ) => {
                const target = e.target;
                let newVal: unknown = target.value;
                if (f.type === "number")
                  newVal = target.value === "" ? "" : Number(target.value);
                updateField(f.name, newVal);
              },
            };
            return (
              <label key={f.name} className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-gray-500">
                  {f.label}
                </span>
                {f.type === "textarea" ? (
                  <textarea rows={3} {...common} />
                ) : f.type === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={!!val}
                    onChange={(e) => updateField(f.name, e.target.checked)}
                    className="h-3 w-3"
                  />
                ) : (
                  <input type={f.type ?? "text"} {...common} />
                )}
              </label>
            );
          })}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={cancel}
              className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CrudList;
