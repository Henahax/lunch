# Lunch

Eine responsive Anwendung für aktuelle Mittagsgerichte teilnehmender Restaurants.

## Funktionen

- Tages- und Wochenangebote nach Restaurant gruppiert. Fehlen Daten für die Zielwoche, bleiben die zuletzt gespeicherten Menüs dezent abgeblendet sichtbar.
- Mobiles Tagesmenü-Carousel mit Wischgeste, Scroll-Snap und Pfeilen; auf dem Desktop erscheint ein Raster.
- Aufklappbare Restaurantbereiche: mobil ist jeweils ein Bereich geöffnet, auf dem Desktop lassen sich die Bereiche unabhängig öffnen. „Weitere Restaurants“ hat passende Standardzustände für Mobile und Desktop; die Auswahl wird in einem Cookie gespeichert.
- Lieblingsgerichte werden im aktuellen Browser gespeichert und mit den Menüs abgeglichen. Optionale Browser-Erinnerungen laufen werktags, solange die App geöffnet ist.
- Menüs werden importiert und in SQLite gespeichert. Der Importstatus ist in der App sichtbar; bei fehlgeschlagenen Aktualisierungen bleiben die zuletzt erfolgreich geladenen Menüs verfügbar.
- Als PWA installierbar; die zuletzt geladene Startseite ist offline verfügbar.

## Restaurants

| Restaurant      | Menüquelle                                                              | Importierte Angebote          |
| --------------- | ----------------------------------------------------------------------- | ----------------------------- |
| Khanittha       | [Restaurantseite](https://khanittha.de/)                                | Wochenangebote                |
| noon food       | [Wochenmenü als PDF](https://noon-food.com/karte/wochenspeisekarte.pdf) | Tages- und Wochenangebote     |
| Zum Riederstein | [Restaurantseite](https://www.zumriederstein.de/)                       | Wochenangebote                |
| Vinzenzmurr     | [Wochenkarte](https://vinzenzmurr.de/wochenkarte/)                      | Wochen- und Tagesangebote     |
| Bindaas         | [Werksviertel-Menü](https://www.bindaas.de/de/werksviertel)             | Wochenangebote nach Kategorie |

Weitere Restaurants ohne importierte Menüs stehen in [`other-restaurants.json`](src/lib/other-restaurants.json).

Das SQLite-Schema und seine Beziehungen sind in [DATA-MODEL.md](DATA-MODEL.md) beschrieben.

## Entwicklung

```sh
npm install
npm run dev
npm run check
npm run lint
npm run build
```
