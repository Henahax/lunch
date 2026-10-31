# Lunch

Eine Seite für die aktuellen Mittagsgerichte teilnehmender Restaurants.

## Features

- Tages- und Wochenangebote gemeinsam je Restaurant anzeigen; der Auf-/Zuklapp-Zustand wird in Cookies gemerkt (initial standardmäßig aufgeklappt) und der heutige Tag dezent hervorgehoben.
- Als installierbare PWA auf dem Handy nutzen; die zuletzt geladene Startseite ist offline verfügbar.
- Im Info-Drawer die wichtigsten Funktionen und den Importstatus nachlesen.
- Gültigkeitszeitraum anzeigen und den Link zur Restaurantseite kompakt in der Kopfzeile des Restaurantblocks anbieten.
- Menüs beim App-Start und täglich um 08:00 Uhr (Europe/Berlin) importieren.
- Importdaten idempotent in SQLite speichern und Importstatus je Quelle in einem Drawer anzeigen. Fehlgeschlagene Aktualisierungen lassen die zuletzt importierten Gerichte sichtbar.
- Manuelle Importe über geschützte Endpunkte auslösen.
- Allergen-Kürzel aus Gerichtnamen und Beschreibungen beim Import entfernen.
- Titel, KW/Datum und die Steuerungsbuttons bleiben beim Scrollen als Sticky-Header sichtbar.
- Lieblingsgerichte im Drawer verwalten, im aktuellen Browser speichern und passende Gerichte markieren. Der Abgleich berücksichtigt Gericht, Beschreibung, Groß-/Kleinschreibung und Umlaute.
- Pro Lieblingsgericht Browser-Erinnerungen aktivieren. Die Berechtigung wird erst beim Aktivieren angefragt. Bei geöffneter Seite wird ab 11:00 Uhr (Europe/Berlin) bis 20:00 Uhr auf passende Tagesgerichte und Wochenangebote geprüft; ein verpasster Hinweis kann beim späteren Öffnen am selben Tag nachgeholt werden. Tagesgerichte werden am jeweiligen Tag, Wochenangebote höchstens am ersten gültigen Tag gemeldet. Hinweise stauen sich nicht bis zum Folgetag auf.
- Vorschläge für Lieblingsgerichte in [`favorite-suggestions.json`](src/lib/favorite-suggestions.json) pflegen; sie erscheinen in zufälliger Reihenfolge als Platzhalter und wiederholen sich bei Bedarf.
- Restaurantreihenfolge, Sichtbarkeit und Auf-/Zuklapp-Zustand werden ein Jahr lang in Cookies gespeichert. Neue Restaurants folgen zunächst der Standardreihenfolge in [`+page.server.ts`](src/routes/+page.server.ts) und sind standardmäßig aufgeklappt.
- Weitere Restaurants ohne Wochenmenü in [`other-restaurants.json`](src/lib/other-restaurants.json) mit `name` und `url` pflegen; sie erscheinen als Link-Grid unter der Hauptansicht.
- Drawer auf Mobilgeräten von unten und auf größeren Bildschirmen von links öffnen; Animationen berücksichtigen `prefers-reduced-motion`.
- Die SQLite-Datenbank und ihre Beziehungen sind in [DATA-MODEL.md](DATA-MODEL.md) beschrieben.

## Restaurants

| Restaurant      | Quelle                                                                            | Erkannte Angebote                                                     |
| --------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Khanittha       | [Shopify-Website](https://khanittha.de/)                                          | Wochenangebote                                                        |
| noon food       | [Wochenspeisekarte als PDF](https://noon-food.com/karte/wochenspeisekarte.pdf)    | Tages- und Wochenangebote                                             |
| Zum Riederstein | [Restaurantseite mit aktueller Mittagskarten-PDF](https://www.zumriederstein.de/) | Wochenangebote                                                        |
| Vinzenzmurr     | [Wochenkarte](https://vinzenzmurr.de/wochenkarte/)                                | Wochenangebote und Tagesgerichte für einzelne oder mehrere Wochentage |
| Bindaas         | [Werksviertel-Seite mit Mittagsmenü-PDF](https://www.bindaas.de/de/werksviertel)  | Wochenangebote nach Kategorie                                         |

## Offene Punkte

- [ ] Optional Web Push ergänzen, damit Erinnerungen auch bei geschlossener Lunch-Seite zugestellt werden.
- [ ] Optional Favoriten zwischen Geräten synchronisieren, falls dafür später Bedarf besteht.
- [ ] Weiteres Restaurant: Zeller (Endgegner)
- [ ] Fade out Restaurant Link beim zuklappen
