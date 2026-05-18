# Swing & Savor: Ambassador-Briefing für den Entwickler

**Ziel dieses Briefings:** Dieses Dokument beschreibt, wie das Ambassador- und Partner-Provisionsmodell von Swing & Savor im MVP technisch und operativ abgebildet werden soll. Es soll **einfach, manuell steuerbar und CRM-tauglich** bleiben. Es darf im MVP kein komplexes Affiliate-System, kein Partnerportal und keine automatisierte Auszahlung gebaut werden.

> **Kernprinzip:** Provisionen werden immer **pro Event** getrackt, nicht pauschal pro Kunde, Club, Region oder Account.

---

## 1. Strategischer Zweck des Ambassador-Modells

Swing & Savor wächst in der Frühphase nicht primär über klassische Werbung oder SaaS-Sales, sondern über persönliche Golfnetzwerke, lokale Organisatoren, Clubmitglieder, Eventmacher und gut vernetzte Golfer. Diese Personen sollen als **Ambassadors** helfen, hochwertige Events, Hosts, Clubs, Sponsoren und Teilnehmer in die Plattform zu bringen.

Das Modell soll Leistung belohnen, aber Swing & Savor vor dauerhaften, unklaren oder zu teuren Revenue-Share-Ansprüchen schützen. Deshalb wird jede Beteiligung **eventbezogen**, **zeitlich begrenzt**, **manuell freigegeben** und **im CRM dokumentiert**.

---

## 2. Finale Provisionslogik

Provisionen werden anhand der tatsächlichen Partnerleistung pro Event vergeben. Es gibt drei Hauptstufen und zwei Renewal-Stufen.

| Rolle | Bedeutung | Provision | Berechnungsbasis |
|---|---|---:|---|
| **Connector** | Öffnet die Tür zu einem qualifizierten Host, Club, Sponsor oder Eventkontakt. | **15 %** | Operativer Deckungsbeitrag des Events |
| **Host Partner** | Bringt den Kontakt und unterstützt aktiv bis zur Zusage oder zum Abschluss. | **30 %** | Operativer Deckungsbeitrag des Events |
| **Operating Partner** | Baut das Event aktiv mit auf oder betreut es operativ. | **50 %** | Operativer Deckungsbeitrag des Events |
| **Renewal passiv** | Folgeevent kommt aus demselben Kontakt, Partner ist aber nicht aktiv beteiligt. | **15 %** | Operativer Deckungsbeitrag des Folgeevents |
| **Renewal aktiv** | Partner hilft erneut aktiv bei Verkauf, Organisation, Betreuung oder Durchführung. | **30 %** | Operativer Deckungsbeitrag des Folgeevents |

Wichtig ist: Ein Partner erhält nicht automatisch dauerhaft die höchste Stufe. **Jedes Event wird einzeln bewertet.** Ein Partner kann beim ersten Event Operating Partner sein und 50 % erhalten, beim nächsten Event aber nur Renewal passiv mit 15 %, wenn keine aktive Leistung mehr erbracht wurde.

---

## 3. Definition: Operativer Deckungsbeitrag

Die Provision wird nicht auf Bruttoumsatz berechnet. Sie wird auch nicht allgemein auf „Netto“ berechnet, wenn dieser Begriff unklar bleibt. Die saubere Berechnungsbasis ist der **operative Deckungsbeitrag des jeweiligen Events**.

> **Operativer Deckungsbeitrag = Eventumsatz minus direkt zurechenbare Eventkosten.**

| Position | Beispiel | Behandlung |
|---|---|---|
| Eventumsatz | Sponsorzahlung, Host-Gebühr, Clubpaket, Teilnehmerbeiträge | Wird als Umsatz berücksichtigt |
| Greenfee-/Locationkosten | Kosten für Golfplatz, Raum, Catering-Flächen | Wird abgezogen |
| Preise / Giveaways | Pokale, Sachpreise, Goodie Bags | Wird abgezogen |
| Fotograf / Videograf | Externe Eventproduktion | Wird abgezogen |
| Payment Fees | Stripe, PayPal, Zahlungsanbieter | Wird abgezogen |
| Externe Dienstleister | Moderation, Eventhelfer, Designproduktion, Spezialleistungen | Wird abgezogen |
| Direkte Eventproduktion | Vor Ort entstandene eventbezogene Kosten | Wird abgezogen |
| Allgemeine Plattformkosten | Entwicklung, Hosting, internes Team | Im MVP nicht pro Event berechnen, außer später explizit definiert |

Beispielrechnung:

| Position | Betrag |
|---|---:|
| Eventumsatz | 4.000 € |
| Greenfee-/Locationkosten | -1.600 € |
| Preise | -400 € |
| Fotograf | -300 € |
| Payment Fees | -120 € |
| **Operativer Deckungsbeitrag** | **1.580 €** |
| Connector 15 % | 237 € |
| Host Partner 30 % | 474 € |
| Operating Partner 50 % | 790 € |

---

## 4. Definition: Was zählt als aktive Beteiligung?

Damit es später keine Diskussionen gibt, muss „aktiv“ klar definiert sein. Für 30 % oder 50 % reicht es nicht, nur in einem WhatsApp-Chat gewesen zu sein oder einmal einen Namen genannt zu haben.

Aktive Beteiligung liegt vor, wenn mindestens eine der folgenden Leistungen nachweisbar erbracht wurde:

| Aktive Leistung | Relevanz für Provision |
|---|---|
| Sponsor aktiv akquiriert | Kann Host Partner oder Operating Partner begründen |
| Teilnehmer aktiv organisiert | Kann Operating Partner begründen |
| Location, Club oder Eventpartner eingebracht | Kann Host Partner oder Operating Partner begründen |
| Event gemeinsam verkauft | Begründet typischerweise Host Partner |
| Kommunikation mit Host, Club oder Sponsor übernommen | Kann Host Partner oder Operating Partner begründen |
| Operative Durchführung unterstützt | Begründet typischerweise Operating Partner |
| Vor-Ort-Betreuung, Check-in, Ablauf oder Community-Steuerung übernommen | Begründet typischerweise Operating Partner |

Die finale Einstufung erfolgt immer manuell durch Swing & Savor Admins.

---

## 5. Zeitregel für Provisionsansprüche

Provisionsansprüche dürfen nicht unbegrenzt offen bleiben. Deshalb gilt:

> **Ein Provisionsanspruch gilt nur für Events innerhalb von 12 Monaten nach Erstkontakt oder innerhalb von 12 Monaten nach der letzten aktiven Beteiligung des Partners.**

Wenn nach Ablauf dieser Frist ein neuer Deal entsteht und der Partner nicht erneut aktiv beteiligt ist, entsteht kein automatischer Anspruch.

---

## 6. Eigentum an Kunden, Daten und Accounts

Diese Regel muss in den internen Bedingungen und im Admin-Hinweis klar dokumentiert werden:

> **Alle Kundenbeziehungen, Eventdaten, Teilnehmerdaten, Sponsordaten, Plattformaccounts, Eventseiten, Recaps, Winner Cards und Plattforminteraktionen verbleiben bei Swing & Savor. Ambassadors erhalten keine Eigentumsrechte an Kunden, Accounts, Regionen, Clubs oder Daten.**

Es gibt im MVP keinen automatischen Gebiets-, Club-, Kunden- oder Regionenschutz.

---

## 7. MVP-Abgrenzung: Was gebaut werden soll und was nicht

Das Ambassador-System soll im MVP bewusst schlank bleiben. Es wird im Admin-/CRM-Bereich abgebildet, nicht als öffentliches Partnerportal.

| Bauen im MVP | Nicht bauen im MVP |
|---|---|
| Ambassador-Datensatz im Admin/CRM | Öffentliches Ambassador-Portal |
| Eventbezogene Zuordnung eines Ambassadors | Automatisiertes Affiliate-Tracking mit Cookies |
| Manuelle Auswahl der Partnerrolle pro Event | Automatische Provisionsentscheidung |
| Berechnung der Provision auf Basis des Deckungsbeitrags | Automatische Auszahlung |
| Statusfelder für Prüfung und Auszahlung | Komplexe Multi-Level-Partnerstruktur |
| Notizfeld für aktive Leistung | Gebietsschutz oder exklusive Regionen |
| Export als CSV oder einfache Tabelle | Partner-Dashboard mit Echtzeit-Umsatz |

---

## 8. Notwendige Datenfelder

### 8.1 Ambassador / Partner

| Feld | Typ | Beschreibung |
|---|---|---|
| ambassador_id | ID | Eindeutige interne ID |
| name | Text | Name des Ambassadors |
| email | Text | Kontakt-E-Mail |
| phone | Text, optional | Telefonnummer |
| community_region | Text, optional | Region oder Golfumfeld, ohne Exklusivitätsanspruch |
| notes | Text | Interne Notizen |
| status | Enum | active, inactive, blocked |
| created_at | Datum | Erstellungsdatum |

### 8.2 Event-Ambassador-Zuordnung

| Feld | Typ | Beschreibung |
|---|---|---|
| event_ambassador_id | ID | Eindeutige ID der Zuordnung |
| event_id | Relation | Verknüpftes Event |
| ambassador_id | Relation | Verknüpfter Ambassador |
| partner_role | Enum | connector, host_partner, operating_partner, renewal_passive, renewal_active |
| commission_rate | Prozent | 15, 30 oder 50 |
| revenue_gross | Zahl | Brutto-Eventumsatz |
| direct_event_costs | Zahl | Direkt zurechenbare Eventkosten |
| operating_contribution | Zahl | Umsatz minus direkte Eventkosten |
| commission_amount | Zahl | Berechnete Provision |
| contribution_description | Text | Beschreibung der Partnerleistung |
| claim_valid_until | Datum | 12 Monate nach Erstkontakt oder letzter aktiver Beteiligung |
| approval_status | Enum | draft, pending_review, approved, rejected, paid |
| approved_by | User-ID, optional | Admin, der freigegeben hat |
| approved_at | Datum, optional | Freigabedatum |
| paid_at | Datum, optional | Auszahlungsdatum |

---

## 9. Berechnungslogik

Die Berechnung soll einfach und transparent sein.

```text
operating_contribution = revenue_gross - direct_event_costs
commission_amount = operating_contribution * commission_rate
```

Wenn der operative Deckungsbeitrag null oder negativ ist, entsteht keine Auszahlung, außer ein Admin überschreibt dies manuell.

```text
if operating_contribution <= 0:
    commission_amount = 0
```

Die Provisionsrate wird durch die gewählte Rolle gesetzt:

| partner_role | commission_rate |
|---|---:|
| connector | 15 % |
| host_partner | 30 % |
| operating_partner | 50 % |
| renewal_passive | 15 % |
| renewal_active | 30 % |

---

## 10. Admin-Workflow

Der Admin-Workflow soll bewusst manuell bleiben.

| Schritt | Aktion |
|---:|---|
| 1 | Admin legt Ambassador an oder wählt bestehenden Ambassador aus. |
| 2 | Admin ordnet Ambassador einem Event zu. |
| 3 | Admin wählt Rolle: Connector, Host Partner, Operating Partner, Renewal passiv oder Renewal aktiv. |
| 4 | System setzt automatisch den passenden Provisionssatz. |
| 5 | Admin trägt Eventumsatz und direkte Eventkosten ein. |
| 6 | System berechnet operativen Deckungsbeitrag und Provision. |
| 7 | Admin beschreibt im Notizfeld die tatsächliche Partnerleistung. |
| 8 | Admin setzt Status auf pending_review, approved oder rejected. |
| 9 | Nach Auszahlung wird Status auf paid gesetzt. |

---

## 11. Rollenbezeichnungen im Produkt

Intern darf technisch mit klaren Enum-Werten gearbeitet werden. Nach außen sollen die Begriffe hochwertiger klingen und zur Marke passen.

| Technischer Wert | Angezeigter Begriff |
|---|---|
| connector | Connector |
| host_partner | Host Partner |
| operating_partner | Operating Partner |
| renewal_passive | Renewal passiv |
| renewal_active | Renewal aktiv |

Optional kann später ein übergreifender Markenbegriff verwendet werden:

> **Founder Ambassador Program**

Im MVP reicht jedoch die interne Admin-Abbildung.

---

## 12. Wichtige Schutzregeln

Folgende Schutzregeln müssen im System oder mindestens in den Admin-Hinweisen abgebildet werden:

| Regel | Bedeutung |
|---|---|
| Pro Event, nicht pro Kunde | Jede Provision wird einzeln je Event geprüft. |
| Keine Lifetime Revenue Shares | Keine unbegrenzten Ansprüche. |
| 12-Monats-Regel | Ansprüche verfallen nach 12 Monaten ohne neue aktive Beteiligung. |
| Keine automatische Exklusivität | Keine automatische Stadt-, Club-, Kunden- oder Regionsexklusivität. |
| Daten gehören Swing & Savor | Kunden-, Event-, Teilnehmer- und Plattformdaten bleiben bei Swing & Savor. |
| Manuelle Freigabe | Keine automatische Auszahlung ohne Admin-Approval. |
| Deckungsbeitrag statt Umsatz | Provision basiert auf operativem Deckungsbeitrag, nicht auf Bruttoumsatz. |

---

## 13. Akzeptanzkriterien für den MVP

Der Ambassador-Bereich gilt als fertig, wenn folgende Punkte erfüllt sind:

| Kriterium | Erfüllt, wenn ... |
|---|---|
| Ambassador anlegen | Admin kann Partner mit Name, E-Mail, Telefon, Region, Status und Notizen erfassen. |
| Event verknüpfen | Admin kann einen Ambassador einem konkreten Event zuordnen. |
| Rolle auswählen | Admin kann eine der fünf Rollen auswählen. |
| Satz automatisch setzen | System setzt 15 %, 30 % oder 50 % passend zur Rolle. |
| Deckungsbeitrag berechnen | System berechnet Umsatz minus direkte Eventkosten. |
| Provision berechnen | System berechnet Provision auf Basis des Deckungsbeitrags. |
| Leistung dokumentieren | Admin kann die konkrete Partnerleistung als Text dokumentieren. |
| Freigabe steuern | Admin kann Status von draft bis paid setzen. |
| Export möglich | Admin kann eine einfache CSV-/Tabellenansicht für Abrechnung exportieren oder kopieren. |

---

## 14. Wichtigste Entwickleranweisung

> **Bitte kein großes Affiliate-System bauen. Das Ambassador-Modell ist im MVP ein manuelles, eventbezogenes CRM- und Abrechnungsmodul. Entscheidend sind saubere Zuordnung, klare Berechnung, manuelle Freigabe und Schutz vor dauerhaften, unklaren Partneransprüchen.**

Das System muss nicht perfekt automatisiert sein. Es muss verhindern, dass Provisionsansprüche unklar, dauerhaft oder falsch berechnet werden.
