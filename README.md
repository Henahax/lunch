# Lunch

Eine Seite für die aktuellen Mittagsgerichte teilnehmender Restaurants.

## Features

- Tages- und Wochenangebote gemeinsam je Restaurant anzeigen; Restaurants standardmäßig aufgeklappt.
- Gültigkeitszeitraum und Link zur Restaurantseite anzeigen.
- Menüs beim App-Start und täglich um 08:00 Uhr (Europe/Berlin) importieren.
- Importdaten idempotent in SQLite speichern und Importstatus je Quelle in einem Drawer anzeigen.
- Manuelle Importe über geschützte Endpunkte auslösen.
- Allergen-Kürzel aus Gerichtnamen und Beschreibungen beim Import entfernen.
- Titel, KW/Datum und Favoritenbutton bleiben beim Scrollen als Sticky-Header sichtbar.
- Lieblingsgerichte im Drawer verwalten, im aktuellen Browser speichern und passende Gerichte markieren. Der Abgleich berücksichtigt Gericht, Beschreibung, Groß-/Kleinschreibung und Umlaute.
- Für einzelne Lieblingsgerichte Browser-Erinnerungen aktivieren. Bei geöffneter Seite wird ab 11:00 Uhr (Europe/Berlin) bis 20:00 Uhr auf passende Tagesgerichte und Wochenangebote geprüft; Hinweise können später am selben Tag nachgeholt werden, Wochenangebote höchstens einmal am ersten gültigen Tag.
- Vorschläge für Lieblingsgerichte in [`favorite-suggestions.json`](src/lib/favorite-suggestions.json) pflegen; sie erscheinen beim Öffnen in zufälliger Reihenfolge als Platzhalter.
- Angezeigte Restaurants über einen Drawer auswählen; die Auswahl wird ein Jahr lang in einem Browser-Cookie gespeichert.
- Anzeigereihenfolge der Restaurants über die Slug-Liste in [`+page.server.ts`](src/routes/+page.server.ts) festlegen; nicht aufgeführte Restaurants folgen alphabetisch.
- Weitere Restaurants ohne Wochenmenü in [`other-restaurants.json`](src/lib/other-restaurants.json) mit `name` und `url` pflegen; sie erscheinen als Link-Grid unter der Hauptansicht.
- Die SQLite-Datenbank und ihre Beziehungen sind in [DATA-MODEL.md](DATA-MODEL.md) beschrieben.

## Restaurants

| Restaurant                | Quelle                                                                            | Erkannte Angebote                                                     |
| ------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Khanittha im Werksviertel | [Shopify-Website](https://khanittha.de/)                                          | Wochenangebote                                                        |
| noon food                 | [Wochenspeisekarte als PDF](https://noon-food.com/karte/wochenspeisekarte.pdf)    | Tages- und Wochenangebote                                             |
| Zum Riederstein           | [Restaurantseite mit aktueller Mittagskarten-PDF](https://www.zumriederstein.de/) | Wochenangebote                                                        |
| Vinzenzmurr               | [Wochenkarte](https://vinzenzmurr.de/wochenkarte/)                                | Wochenangebote und Tagesgerichte für einzelne oder mehrere Wochentage |
| Bindaas Werksviertel      | [Werksviertel-Seite mit Mittagsmenü-PDF](https://www.bindaas.de/de/werksviertel)  | Wochenangebote nach Kategorie                                         |

## Offene Punkte

- [ ] Den PDF-Import für Zum Riederstein bei Gelegenheit weiter verbessern; aktuell werden noch nicht alle Gerichte zuverlässig erkannt.
- [ ] Optional: Web Push ergänzen, damit Lieblingsgericht-Erinnerungen auch bei geschlossener Lunch-Seite ankommen.
- [ ] Optional Favoriten zwischen Geräten synchronisieren, falls dafür später Bedarf besteht.
- [ ] Weiteres Restaurant: Zeller (Endgegner)
- [ ] Header-Typografie finalisieren
- [ ] Footer
- [ ] Open-Source
- [ ] CSS, moderne Media Queries
- [ ] UI Redesign
- [ ] Khanitta import fehlgeschlagen prüfen
