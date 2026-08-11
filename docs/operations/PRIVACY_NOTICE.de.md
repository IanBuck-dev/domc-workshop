# Datenschutz- und Sicherheitshinweis für den Prototyp

Dieses Werkzeug ist ausschließlich für Workshops mit fiktiven oder wirksam anonymisierten Inhalten bestimmt. Es ist nicht für produktive Schadenbearbeitung freigegeben.

Nicht eingeben: echte Schadenakten, Namen, Kontaktdaten, Vertragsnummern, Gesundheitsdaten, Beschäftigtendaten, Betrugshinweise zu Personen, Geschäftsgeheimnisse oder andere vertrauliche Produktionsdaten.

Eingaben, Prozessbeschreibungen, KI-Strukturierungen, Auditverläufe und Uploads werden auf dem vom Betreiber verwalteten Raspberry Pi im Ordner `workspace` gespeichert. Bei einer ausdrücklich gestarteten Claude-Aktion werden nur die aktuelle Prozesserfassung, die dafür ausgewählten Uploads, die eingefrorene Erfassungskonfiguration und die benötigten Antworten an die lokal authentifizierte Claude-CLI übergeben. Die Verarbeitung erfolgt damit nicht ausschließlich lokal: Hosting, Übermittlung und Aufbewahrung bei Anthropic richten sich nach dem verwendeten Claude-Konto und müssen vor jeder betrieblichen Nutzung durch Datenschutz und Informationssicherheit freigegeben werden.

Der Anwendungszugang verwendet ein gemeinsames Testkonto und ist keine personenbezogene Berechtigungsverwaltung. Die Cloudflare-Verbindung schützt den Transport, ersetzt aber weder eine Datenschutzfreigabe noch ein produktives Rollen- und Löschkonzept. Für den Workshop gelten die im öffentlichen Datenschutztext hinterlegten Löschfristen; für einen späteren Produktivbetrieb müssen Aufbewahrung, Auditierung und Löschung gesondert konzipiert werden.

Ausgaben sind unverbindliche Empfehlungen. Der Prototyp entscheidet nicht über DSGVO, EU AI Act, DORA, VAG oder BaFin-Anforderungen. Folgenreiche Entscheidungen zu Leistung, Ablehnung, Auszahlung, Reserve, Betrugsbearbeitung, Kundenkommunikation oder Beschäftigten dürfen nicht automatisiert aus diesem Prototyp übernommen werden.
