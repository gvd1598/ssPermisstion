# Permission Management System

A React-based permission management system for managing Role → Feature → Menu → Action mappings.

## Features

- **Drag & Drop Interface**: Drag Features and Menus to assign them to Roles
- **CRUD Operations**: Manage Roles, Actions, and Menus
- **CSV Import/Export**: Import and export permission configurations
- **Persistent Storage**: Automatically saves to localStorage

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Usage

### Managing Permissions

1. **Add Roles/Actions/Menus**: Use the CRUD lists in the left column to add and edit entities
2. **Assign Features to Roles**: Drag Features from the right palette and drop them into Role cards
3. **Assign Menus to Features**: Drag Menus from the right palette and drop them into Feature zones within Role cards
4. **Select Actions**: Check the permission actions for each Menu within a Feature

### CSV Import/Export

#### Export CSV

Click the "Export CSV" button in the toolbar to download the current permission configuration as a CSV file.

**CSV Format:**

```csv
role_id,role_name,feature_id,feature_name,menu_id,menu_name,permission_action_id,permission_action_name,permission_action_code,createdAt,updatedAt,createdBy,updatedBy
1,Admin,1,Dashboard,1,Home,1,ดู,VIEW,1728000000000,1728000000000,system,system
```

#### Import CSV

1. Click the "Import CSV" button in the toolbar
2. Select a CSV file matching the export format
3. The system will parse and load the permissions
4. Existing mappings will be replaced with the imported data

**Sample CSV file** is provided: `sample-permissions.csv`

### Search & Filter

- Use the search box in the toolbar to filter Features
- Use the search boxes in the right palette to filter Features and Menus

## Technology Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
