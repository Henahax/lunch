# Planungsdokument

## Ziel

- Seite, die rotierende Mittags-Menüs umliegender Restaurants anzeigt
- Erinnerungen für Lieblingsgerichte

## Tech Stack

- node
- Svelte, Sveltekit
- SQLite

## Ablauf

- cronjob
- ein crawler pro Restaurant holt Daten
  - Daten können Web, PDF oder Bilder sein
- schreibt mit Datum in SQLite DB
- Seite zeigt Plan an

## UI

- Kalender Ansicht
- Woche, Tage
- Links zu Karten
- Liste/Kacheln weiterer Restaurants
