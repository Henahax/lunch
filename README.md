# Lunch – Planungsdokument

## Ziel

Eine Seite zeigt die wechselnden Mittagsmenüs umliegender Restaurants. Nutzer können Lieblingsgerichte auswählen und sich an diese erinnern lassen.

## Technischer Rahmen

- Node.js
- Svelte und SvelteKit
- SQLite
- Drizzle ORM
- PDF.js zum Auslesen textbasierter PDFs

## Umsetzungsplan

Die Funktionen werden schrittweise umgesetzt. Jeder Schritt soll einen nutzbaren und überprüfbaren Stand ergeben.

### 1. Daten und erste Quelle festlegen ✅

- Erstes Restaurant: Khanittha im Werksviertel mit regelmäßig aktualisierter Shopify-Website.
- Die konkrete Website und den Bereich mit dem Speiseplan identifizieren.
- Prüfen, ob der Speiseplan als strukturierte Shopify-Daten, im HTML der Seite oder als PDF/Bild veröffentlicht wird.
- Quelle und Format untersuchen und klären, ob die Daten öffentlich und stabil abrufbar sind.
- Festlegen, welche Informationen ein Menüeintrag mindestens braucht: Gericht, Beschreibung, Preis (falls verfügbar), Restaurant und Datum bzw. Gültigkeitszeitraum.
- Festlegen, wie Tageskarten und Wochenkarten sowie fehlende oder geänderte Einträge behandelt werden.

**Ergebnis:** Ein konkretes Quellbeispiel, ein geeigneter Abrufweg und ein abgestimmtes Datenformat.

### 2. Datenmodell und Datenbank vorbereiten ✅

- Tabellen für Restaurants, Tageskarten, Wochenkarten und Menüeinträge entwerfen.
- Quelle und Gültigkeitszeitraum eines Eintrags nachvollziehbar speichern.
- Eindeutige Schlüssel bzw. Regeln für wiederholte Importe festlegen, damit derselbe Speiseplan keine Duplikate erzeugt.
- Datenbankschema und Migrationen einrichten.

**Ergebnis:** Menüdaten können konsistent und wiederholbar gespeichert werden.

### 3. Einen Restaurant-Abruf umsetzen ✅

- [x] Eine klar abgegrenzte Schnittstelle für Restaurant-Abrufe definieren.
- [x] Den sichtbaren Shopify-Wochenplan auslesen und in das vereinbarte Format normalisieren.
- [x] Restaurant, Speiseplan und Gerichte idempotent in SQLite speichern.
- [x] Einen geschützten HTTP-Endpunkt zum Auslösen des Imports bereitstellen.
- [x] Den echten Abruf ausführen und die Shopify-Gerichte korrekt erkennen.
- [x] Wiederholten Import ohne Duplikate ausführen.
- [x] Importversuche, letzte Erfolge und Fehler je Quelle protokollieren.
- [x] Fehlgeschlagene und länger als sieben Tage nicht aktualisierte Importe im UI anzeigen.

**Ergebnis:** Ein wiederholbarer Datenimport für ein Restaurant.

### 4. UI an echte Menüdaten anbinden ✅

- [x] Menüdaten für die aktuelle Woche serverseitig aus SQLite laden.
- [x] Die Platzhalter durch Tageskarten, Wochenkarten und einen Leerzustand ersetzen.
- [x] Die Seite mit importierten Daten aus beiden Quellen prüfen.
- [x] Fehlgeschlagene und veraltete Daten verständlich darstellen.

**Ergebnis:** Das UI zeigt den gespeicherten Speiseplan des ersten Restaurants.

### 5. Zweite Quelle: Noon-PDF ✅

- Quelle: https://noon-food.com/karte/wochenspeisekarte.pdf
- [x] Textbasierte PDF lesen und Kalenderwoche sowie Aktualisierungsdatum abgleichen.
- [x] Tagesgerichte den Wochentagen und Wochenangebote dem Wochenzeitraum zuordnen.
- [x] Vegetarische Weekly-Bowl-Optionen dem zugehörigen Bowl-Gericht zuordnen.
- [x] Import idempotent speichern und beide Kartenarten im UI darstellen.
- [x] Fehler bei geändertem oder veraltetem PDF im UI sichtbar machen.

**Ergebnis:** Die PDF liefert getrennte Tages- und Wochenkarten im gemeinsamen Datenformat.

### 6. Weitere Restaurants ergänzen

- Für jedes Restaurant einen eigenen Abruf ergänzen, sofern sich Quelle oder Format unterscheiden.
- Gemeinsame Verarbeitung und Speicherung wiederverwenden.
- Restaurantinformationen und Quellen konfigurierbar halten, statt sie in der UI fest einzubauen.

**Ergebnis:** Mehrere Restaurants liefern Daten im selben Format an die Seite.

### 7. Regelmäßige Aktualisierung einrichten – in Arbeit

- [x] Beim Start des einzelnen Node-Containers beide Quellen einmal importieren und danach täglich um 06:00 Uhr Europe/Berlin erneut abrufen.
- [x] Den Importstatus je Quelle speichern und Fehler im UI sowie in den Container-Logs sichtbar machen.
- [x] Die geschützten HTTP-Endpunkte für manuelle Abrufe beibehalten; Importe bleiben idempotent.
- [x] Den Status beim Start der App additiv anlegen, ohne vorhandene Menüdaten neu aufzubauen.
- [ ] Den aktualisierten Stand im tatsächlichen Docker-Container ausrollen und Start, Logs sowie Statusanzeige prüfen.

**Ergebnis:** Die Menüdaten werden regelmäßig aktualisiert und Fehler sind nachvollziehbar.

### 8. Lieblingsgerichte und Erinnerungen ergänzen

- Festlegen, wie Gerichte erkannt werden, wenn Schreibweise oder Beschreibung leicht variieren.
- Lieblingsgerichte speichern und mit eingehenden Menüs abgleichen.
- Erinnerungsweg und Zeitpunkt festlegen und die Erinnerungen umsetzen.

**Ergebnis:** Nutzer können passende Lieblingsgerichte wiederfinden und erhalten Erinnerungen.

## Leitlinien

- Zuerst einen vollständigen Ablauf für ein Restaurant umsetzen, bevor weitere Quellen hinzukommen.
- Import und Speicherung idempotent gestalten: Wiederholungen dürfen keine Duplikate erzeugen.
- Quelldaten und normalisierte Menüdaten trennen, soweit es für Fehlersuche und erneute Verarbeitung nötig ist.
- Die Datenbeschaffung serverseitig ausführen; Zugangsdaten gehören nicht in den Browser.
- Einen Scheduler erst einführen, wenn der manuelle Import zuverlässig funktioniert.

## Docker-Betrieb

- Der GitHub-Workflow veröffentlicht von `main` die Tags `henahax/lunch:latest` und `henahax/lunch:<Version>` auf Docker Hub.
- Die Deployment-Definition liegt im Homelab-Repository unter `services/henahax/docker-compose.yml` und wird in Portainer gepflegt.
- In Portainer die Umgebungsvariable `CRON_SECRET` setzen; die GitHub-Actions-Secrets `DOCKERHUB_USERNAME` und `DOCKERHUB_PASSWORD` werden für die Veröffentlichung benötigt.
- Traefik stellt die App unter `lunch.henahax.net` und `lunch.henahax.de` bereit.
- Die SQLite-Datenbank liegt unter `/app/data/lunch.db`; das Homelab bindet `/container-volumes/data/lunch` ein, damit sie Container-Updates übersteht.
- Der Container richtet das Datenverzeichnis ein und startet die App als unprivilegierter `node`-Benutzer. Beim ersten Start legt die App das Schema an; der Import-Scheduler startet im App-Prozess.
