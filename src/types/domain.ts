// Frontend domain types adapted from Prisma schema (simplified)
export interface PackageEntity {
  id: number; // autoincrement id
  name: string;
  description?: string | null;
  code: string; // e.g., "basic"
  price: number; // decimal converted to number for UI
  durationDay: number; // number of days
  active: boolean;
  createdAt: string; // ISO for UI only
  updatedAt: string; // ISO
  createdBy: string;
  updatedBy: string;
  [key: string]: unknown;
}

export interface FeatureEntity {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isOpen: boolean;
  [key: string]: unknown;
}

export interface PackageFeatureLink {
  packageId: number;
  featureId: number;
}

// Helper creators (could integrate with real API later)
export const createEmptyPackage = (nextId: number): PackageEntity => ({
  id: nextId,
  name: "",
  description: "",
  code: "basic",
  price: 0,
  durationDay: 30,
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: "",
  updatedBy: "",
});

export const createEmptyFeature = (nextId: number): FeatureEntity => ({
  id: nextId,
  name: "",
  code: "",
  description: "",
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: "",
  updatedBy: "",
  isOpen: true,
});

// ===== Roles & Permission Actions (for role-feature-permission admin) =====
export interface RoleEntity {
  id: number;
  name: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  active: boolean;
  code?: string | null;
  [key: string]: unknown;
}

export const createEmptyRole = (nextId: number): RoleEntity => ({
  id: nextId,
  name: "",
  isSystem: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: "",
  updatedBy: "",
  active: true,
  code: "",
});

export interface PermissionActionEntity {
  id: number;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  active: boolean;
  [key: string]: unknown;
}

export const createEmptyPermissionAction = (
  nextId: number
): PermissionActionEntity => ({
  id: nextId,
  name: "",
  code: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: "",
  updatedBy: "",
  active: true,
});

// ===== Menu (for Menu -> Role mapping) =====
export interface MenuEntity {
  id: number;
  path: string;
  name: string;
  icon?: string | null;
  group?: string | null;
  type?: string | null; // MenuType as string for UI
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  [key: string]: unknown;
}

export const createEmptyMenu = (nextId: number): MenuEntity => ({
  id: nextId,
  path: "",
  name: "",
  icon: "",
  group: "",
  type: "PARENT",
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: "",
  updatedBy: "",
});
