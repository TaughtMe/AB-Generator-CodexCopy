# Print QA Checklist (A4 Sync)

Stand: 2026-03-03

## 1. Setup
1. Dev-Server starten: `npm run dev`.
2. Browser-Printdialog auf `100%` setzen.
3. Im Printdialog `An Seite anpassen/Fit to page` deaktivieren.
4. Als PDF speichern (Student und Teacher separat).

## 2. Referenzblätter
1. Blatt A: Mehrere Cloze-Lücken (`continuous` und `per-letter`) + 1x Multiple Choice.
2. Blatt B: Langer Fließtext + mindestens 1 Seitenumbruch + 1x Multiple Choice mit langen Antworttexten.

## 3. Slice 1 (Maßstab / Paginierung)
1. Prüfen, dass Editor und PDF gleiche nutzbare Seitenbreite haben.
2. Prüfen, dass Seitenumbrüche Editor/PDF maximal um eine Zeile differieren.
3. Prüfen, dass Textgröße im PDF nicht sichtbar kleiner/größer als im Editor wirkt.
4. Erwartung: Kein systematisches „im PDF passt mehr auf eine Seite“.

## 4. Slice 2 (Cloze)
1. Student-PDF öffnen.
2. Jede Lücke prüfen.
3. Erwartung: Genau eine sichtbare Linie pro Lücke, keine zweite Unterstrich-Linie.
4. Teacher-PDF öffnen.
5. Erwartung: Lösungen sind lesbar (grün), keine unsichtbaren Antworten.

## 5. Slice 3 (Multiple Choice UI)
1. Student-PDF öffnen.
2. Erwartung: Antwortzeilen im Card-Look mit Rahmen, Padding und Rundung.
3. Erwartung: Checkbox links sichtbar und sauber gerahmt.
4. Teacher-PDF öffnen.
5. Erwartung: Korrekte Antworten mit grünem Haken/Markierung.
6. Erwartung: Lange Antworttexte umbrechen innerhalb der Karte.

## 6. Regression
1. Header (Logo/Name/Datum/Klasse) bleibt korrekt.
2. Task-Nummern sind im Print sichtbar.
3. Tabellen/Lineatur/Spaltenlayout bleiben unverändert.
4. Keine neuen abgeschnittenen Inhalte am Seitenende.

## 7. Dokumentation des Ergebnisses
1. Für Blatt A und Blatt B je ein Student- und ein Teacher-PDF ablegen.
2. Pro Check `PASS` oder `FAIL` notieren.
3. Bei `FAIL` Dateiname + kurze Beschreibung + Screenshot vermerken.
