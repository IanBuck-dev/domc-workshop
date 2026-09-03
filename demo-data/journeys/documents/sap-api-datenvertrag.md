# Entwurf Datenvertrag SAP S/4HANA → KOMPASS

Fiktive technische Arbeitsunterlage der LifeCorp-Demo.

| Feld             | Bedeutung                                         | Pflicht |
| ---------------- | ------------------------------------------------- | ------- |
| buchungsreferenz | eindeutige SAP-Buchung                            | ja      |
| valutadatum      | fachliches Wertstellungsdatum                     | ja      |
| betrag           | gebuchter Betrag in EUR                           | ja      |
| vertragsreferenz | optionale Vertragsnummer aus dem Verwendungszweck | nein    |
| schadenreferenz  | optionale Schadennummer aus dem Verwendungszweck  | nein    |

Verspätete Buchungen müssen ihren ursprünglichen Buchungszeitpunkt behalten.
KOMPASS darf ohne bestätigte Referenz keine automatische Zuordnung auslösen.
