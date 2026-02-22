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
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
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
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Datenverwaltung (Backup, Import, Hard Reset)

Im Bereich **Globale Einstellungen → Datenverwaltung** gibt es drei Aktionen:

- **Backup herunterladen**: Speichert Arbeitsblätter, Einstellungen und Design-Vorlagen als `ab-generator-backup.json`.
- **Backup wiederherstellen**: Liest eine zuvor exportierte JSON-Datei ein, überschreibt lokale Daten und lädt die Seite neu.
- **Alle lokalen Daten löschen**: Leert LocalStorage und IndexedDB vollständig und lädt die Seite neu.

### Wichtiger Hinweis zu Bildern

In der aktuellen Phase werden Bilddaten (z. B. Blob/Base64-Inhalte) bewusst **nicht** in das JSON-Backup aufgenommen, damit die Datei klein und robust bleibt.

### Manuelle Kurz-Tests (für Nicht-Programmierer)

1. **Backup testen**
  - Öffne **Globale Einstellungen → Datenverwaltung**.
  - Klicke auf **Backup herunterladen**.
  - Prüfe, ob eine Datei `ab-generator-backup.json` im Download-Ordner liegt.

2. **Wiederherstellung testen**
  - Erstelle oder ändere vorher sichtbar Daten (z. B. Titel eines Arbeitsblatts).
  - Klicke auf **Backup wiederherstellen** und wähle die Backup-Datei.
  - Die Seite lädt neu. Prüfe danach, ob der gespeicherte Stand wieder da ist.

3. **Hard Reset testen**
  - Klicke auf **Alle lokalen Daten löschen** und bestätige den Dialog.
  - Die Seite lädt neu.
  - Prüfe danach, ob die App wie frisch gestartet wirkt (keine lokalen Daten mehr sichtbar).

### Fehlerhilfe (einfach)

- **„Backup konnte nicht importiert werden“**
  - Prüfe, ob du wirklich eine `.json`-Datei aus **dieser App** gewählt hast.
  - Öffne die Datei kurz in einem Editor: Sie sollte mit `{` beginnen und lesbaren Text enthalten.

- **Nach Import fehlen Bilder**
  - Das ist in dieser Phase normal: Bilddaten sind aktuell nicht Teil des JSON-Backups.

- **Nach Klick auf Backup passiert scheinbar nichts**
  - Prüfe den Download-Ordner und den Browser-Downloadverlauf.
  - Manche Browser blockieren Downloads, wenn Popups/Downloads eingeschränkt sind.

- **Reset wurde abgebrochen**
  - Wenn der Bestätigungsdialog geschlossen oder auf „Abbrechen“ geklickt wird, bleiben alle Daten erhalten.

- **Ich bin unsicher, ob alles geklappt hat**
  - Starte den 3‑Punkte-Check von oben (Backup → Import → Reset) einmal komplett durch.

### Was wird gesichert?

| Wird gesichert | Wird nicht gesichert |
|---|---|
| Arbeitsblätter (Inhalte, Reihenfolge, Metadaten) | Bilddaten (Blob/Base64) |
| Globale Einstellungen (inkl. KI-/Design-Einstellungen) | Bereits vorhandene Browser-Downloads |
| Design-Vorlagen (ohne eingebettete Bilddaten) | Externe Dienste / Cloud-Daten |
