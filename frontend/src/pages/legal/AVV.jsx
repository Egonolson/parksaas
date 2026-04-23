import { Link } from 'react-router-dom'

export default function AVV() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium mb-8">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück zur Startseite
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Auftragsverarbeitungsvertrag (AVV)</h1>
          <p className="text-gray-500 text-sm mb-8">gemäß Art. 28 DSGVO — Stand: April 2026</p>

          <div className="prose prose-gray max-w-none space-y-8 text-gray-700 text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Präambel</h2>
              <p>
                Dieser Auftragsverarbeitungsvertrag (nachfolgend „AVV") wird geschlossen zwischen dem Betreiber-Nutzer der ParkSaaS-Plattform
                (nachfolgend „Verantwortlicher" oder „Auftraggeber") und ParkSaaS (Vision X Digital), Sebastian Hendrich, Berliner Str. 14,
                07545 Gera (nachfolgend „Auftragsverarbeiter").
              </p>
              <p>
                Der Auftragsverarbeiter verarbeitet im Auftrag des Verantwortlichen personenbezogene Daten. Dieser AVV konkretisiert die
                datenschutzrechtlichen Rechte und Pflichten der Parteien im Zusammenhang mit der Nutzung der ParkSaaS-Plattform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 1 Gegenstand und Dauer der Verarbeitung</h2>
              <p>(1) Gegenstand der Auftragsverarbeitung ist die Bereitstellung der ParkSaaS-Plattform zur Verwaltung von Parkplätzen, Buchungen und Kundendaten.</p>
              <p>(2) Die Verarbeitung erfolgt auf unbestimmte Zeit und endet mit Beendigung des Nutzungsvertrags zwischen dem Verantwortlichen und ParkSaaS.</p>
              <p>(3) Der Auftragsverarbeiter verarbeitet die personenbezogenen Daten ausschließlich im Gebiet der Europäischen Union bzw. des Europäischen Wirtschaftsraums.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 2 Art und Zweck der Verarbeitung</h2>
              <p>Die Verarbeitung umfasst folgende Tätigkeiten:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Speicherung und Verwaltung von Kundendaten (Name, Kontaktdaten, Anschrift)</li>
                <li>Speicherung von Buchungsdaten (Stellplatz, Buchungszeitraum, Kennzeichen)</li>
                <li>Verarbeitung von Zahlungsinformationen (Weiterleitung an Zahlungsdienstleister)</li>
                <li>Erstellung und Versand von Rechnungen und Buchungsbestätigungen</li>
                <li>Bereitstellung des Kundenportals</li>
                <li>Automatische Datensicherung</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 3 Art der personenbezogenen Daten</h2>
              <p>Folgende Arten personenbezogener Daten werden verarbeitet:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Kontaktdaten (Name, E-Mail, Telefon)</li>
                <li>Adressdaten (Straße, PLZ, Stadt)</li>
                <li>Unternehmensdaten (Firmenname, Steuernummer)</li>
                <li>Buchungsdaten (Stellplatz, Zeitraum, Preis)</li>
                <li>Fahrzeugdaten (Kennzeichen)</li>
                <li>Zahlungsdaten (Zahlungsstatus, Beträge, Rechnungsnummern)</li>
                <li>Nutzungsdaten (Login-Zeiten, IP-Adressen)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 4 Kategorien betroffener Personen</h2>
              <p>Die Verarbeitung betrifft folgende Kategorien betroffener Personen:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Kunden (Endnutzer), die über die Plattform Stellplätze buchen</li>
                <li>Geschäftskunden und deren Mitarbeiter</li>
                <li>Ansprechpartner der Kunden</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 5 Pflichten des Auftragsverarbeiters</h2>
              <p>(1) Der Auftragsverarbeiter verarbeitet personenbezogene Daten ausschließlich auf dokumentierte Weisung des Verantwortlichen, es sei denn, er ist durch Unionsrecht oder das Recht der Mitgliedstaaten zu einer anderweitigen Verarbeitung verpflichtet.</p>
              <p>(2) Der Auftragsverarbeiter gewährleistet, dass sich die zur Verarbeitung der personenbezogenen Daten befugten Personen zur Vertraulichkeit verpflichtet haben oder einer angemessenen gesetzlichen Verschwiegenheitspflicht unterliegen.</p>
              <p>(3) Der Auftragsverarbeiter ergreift alle gemäß Art. 32 DSGVO erforderlichen technischen und organisatorischen Maßnahmen, insbesondere:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Verschlüsselung personenbezogener Daten bei der Übertragung (TLS/SSL)</li>
                <li>Verschlüsselung von Passwörtern (bcrypt)</li>
                <li>Zugangs- und Zugriffskontrolle durch authentifizierte Benutzerkonten</li>
                <li>Regelmäßige Datensicherungen</li>
                <li>Überwachung der Systemsicherheit</li>
                <li>Mandantentrennung zur Sicherstellung der Datenisolation</li>
              </ul>
              <p>(4) Der Auftragsverarbeiter unterstützt den Verantwortlichen bei der Erfüllung der Betroffenenrechte gemäß Art. 12–22 DSGVO.</p>
              <p>(5) Der Auftragsverarbeiter informiert den Verantwortlichen unverzüglich über Verletzungen des Schutzes personenbezogener Daten (Datenpannen) gemäß Art. 33 DSGVO.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 6 Unterauftragsverarbeiter</h2>
              <p>(1) Der Auftragsverarbeiter bedient sich folgender Unterauftragsverarbeiter:</p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 font-medium text-gray-900">Unternehmen</th>
                      <th className="text-left py-2 font-medium text-gray-900">Leistung</th>
                      <th className="text-left py-2 font-medium text-gray-900">Standort</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-2">Mollie B.V.</td>
                      <td className="py-2">Zahlungsabwicklung</td>
                      <td className="py-2">Niederlande (EU)</td>
                    </tr>
                    <tr>
                      <td className="py-2">Hosting-Provider</td>
                      <td className="py-2">Server-Hosting, Datenspeicherung</td>
                      <td className="py-2">Deutschland (EU)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>(2) Der Auftragsverarbeiter wird den Verantwortlichen über jede beabsichtigte Änderung in Bezug auf die Hinzuziehung oder Ersetzung von Unterauftragsverarbeitern informieren, wodurch der Verantwortliche die Möglichkeit erhält, gegen derartige Änderungen Einspruch zu erheben.</p>
              <p>(3) Der Auftragsverarbeiter stellt sicher, dass Unterauftragsverarbeitern dieselben Datenschutzpflichten auferlegt werden wie in diesem AVV.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 7 Rechte des Verantwortlichen</h2>
              <p>(1) Der Verantwortliche hat das Recht, die Einhaltung der Datenschutzvorschriften und der Bestimmungen dieses AVV durch den Auftragsverarbeiter zu überprüfen.</p>
              <p>(2) Der Auftragsverarbeiter stellt dem Verantwortlichen alle erforderlichen Informationen zum Nachweis der Einhaltung der in Art. 28 DSGVO niedergelegten Pflichten zur Verfügung.</p>
              <p>(3) Inspektionen durch den Verantwortlichen oder einen von ihm beauftragten Prüfer sind nach angemessener Vorankündigung während der üblichen Geschäftszeiten möglich.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 8 Löschung und Rückgabe von Daten</h2>
              <p>(1) Nach Beendigung des Vertragsverhältnisses löscht der Auftragsverarbeiter sämtliche personenbezogenen Daten, die im Auftrag des Verantwortlichen verarbeitet wurden, sofern nicht Unionsrecht oder das Recht der Mitgliedstaaten eine weitere Speicherung vorschreibt.</p>
              <p>(2) Auf Wunsch des Verantwortlichen stellt der Auftragsverarbeiter vor der Löschung eine Kopie der Daten in einem gängigen, maschinenlesbaren Format zur Verfügung.</p>
              <p>(3) Die Löschung erfolgt innerhalb von 30 Tagen nach Vertragsende, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 9 Schlussbestimmungen</h2>
              <p>(1) Dieser AVV unterliegt dem Recht der Bundesrepublik Deutschland.</p>
              <p>(2) Sollten einzelne Bestimmungen dieses AVV unwirksam sein oder werden, so bleibt die Wirksamkeit der übrigen Bestimmungen davon unberührt.</p>
              <p>(3) Dieser AVV wird mit der Akzeptanz im Rahmen des Onboarding-Prozesses auf der ParkSaaS-Plattform wirksam.</p>
              <p>(4) Änderungen und Ergänzungen dieses AVV bedürfen der Textform.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
