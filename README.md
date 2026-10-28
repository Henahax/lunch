# Lunch

Eine Seite für die aktuellen Mittagsgerichte teilnehmender Restaurants.

## Features

- Tages- und Wochenangebote gemeinsam je Restaurant anzeigen; Restaurants standardmäßig aufgeklappt.
- Gültigkeitszeitraum und Link zur Restaurantseite anzeigen.
- Menüs beim App-Start und täglich um 06:00 Uhr (Europe/Berlin) importieren.
- Importdaten idempotent in SQLite speichern und Importstatus je Quelle anzeigen.
- Manuelle Importe über geschützte Endpunkte auslösen.
- Lieblingsgerichte im Drawer verwalten, im aktuellen Browser speichern und passende Gerichte markieren. Der Abgleich berücksichtigt Gericht, Beschreibung, Groß-/Kleinschreibung und Umlaute.
- Die SQLite-Datenbank und ihre Beziehungen sind in [DATA-MODEL.md](DATA-MODEL.md) beschrieben.

## Restaurants

| Restaurant | Quelle | Erkannte Angebote |
| --- | --- | --- |
| Khanittha im Werksviertel | [Shopify-Website](https://khanittha.de/) | Wochenangebote |
| noon food | [Wochenspeisekarte als PDF](https://noon-food.com/karte/wochenspeisekarte.pdf) | Tages- und Wochenangebote |
| Zum Riederstein | [Restaurantseite mit aktueller Mittagskarten-PDF](https://www.zumriederstein.de/) | Wochenangebote |

## Offene Punkte

- [ ] Den PDF-Import für Zum Riederstein bei Gelegenheit weiter verbessern; aktuell werden noch nicht alle Gerichte zuverlässig erkannt.
- [ ] Für Lieblingsgerichte festlegen, ob und wann Browser- oder Push-Erinnerungen kommen sollen, und den gewählten Weg umsetzen.
- [ ] Optional Favoriten zwischen Geräten synchronisieren, falls dafür später Bedarf besteht.
- [ ] Weitere Restaurants: Bindaas, vinzenzmurr, Zeller (Endgegner)
- [ ] Link-Kacheln mit weiteren Imbissen und Restaurants in der Gegend
- [ ] Header verbessern
- [ ] Footer
- [ ] Open-Source
- [ ] CSS, moderne Media Queries
- [ ] UI Redesign
- [ ] Restaurants ausblenden
- [ ] Khanitta import fehlgeschlagen prüfen
