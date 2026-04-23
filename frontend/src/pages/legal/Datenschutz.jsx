import { Link } from 'react-router-dom'

export default function Datenschutz() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Datenschutzerklärung</h1>
          <p className="text-gray-500 text-sm mb-8">Stand: April 2026</p>

          <div className="prose prose-gray max-w-none space-y-8 text-gray-700 text-sm leading-relaxed">
            {/* §1 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Verantwortlicher</h2>
              <p>Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</p>
              <p className="mt-2">
                ParkSaaS (Vision X Digital)<br />
                Sebastian Hendrich<br />
                Berliner Str. 14<br />
                07545 Gera<br />
                E-Mail: info@visionmakegpt.work
              </p>
            </section>

            {/* §2 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Erhobene Daten</h2>
              <p>Wir erheben und verarbeiten folgende personenbezogene Daten:</p>
              <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">2.1 Bei der Registrierung als Betreiber-Nutzer:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Firmenname</li>
                <li>E-Mail-Adresse</li>
                <li>Passwort (verschlüsselt gespeichert)</li>
                <li>URL-Slug</li>
                <li>Telefonnummer (optional)</li>
                <li>Adresse (optional)</li>
              </ul>
              <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">2.2 Bei der Registrierung als Kunde:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Vor- und Nachname</li>
                <li>E-Mail-Adresse</li>
                <li>Telefonnummer</li>
                <li>Anschrift (Straße, PLZ, Ort)</li>
                <li>Passwort (verschlüsselt gespeichert)</li>
                <li>Kundentyp (privat/geschäftlich)</li>
                <li>Bei Geschäftskunden: Firmenname, Steuernummer/USt-IdNr.</li>
              </ul>
              <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">2.3 Bei der Buchung eines Stellplatzes:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Persönliche Daten des Buchenden (Name, E-Mail, Telefon, Anschrift)</li>
                <li>Kennzeichen des Fahrzeugs</li>
                <li>Buchungszeitraum und gewählter Stellplatz</li>
                <li>Zahlungsinformationen (verarbeitet durch Mollie B.V.)</li>
              </ul>
              <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">2.4 Technische Daten bei der Nutzung der Plattform:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>IP-Adresse</li>
                <li>Browsertyp und -version</li>
                <li>Betriebssystem</li>
                <li>Datum und Uhrzeit des Zugriffs</li>
                <li>Referrer-URL</li>
              </ul>
            </section>

            {/* §3 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Zweck der Datenverarbeitung</h2>
              <p>Die Verarbeitung Ihrer personenbezogenen Daten erfolgt zu folgenden Zwecken:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Bereitstellung und Betrieb der ParkSaaS-Plattform</li>
                <li>Erstellung und Verwaltung von Nutzerkonten</li>
                <li>Abwicklung von Buchungen und Zahlungen</li>
                <li>Erstellung von Rechnungen und Vertragsdokumenten</li>
                <li>Kommunikation mit Nutzern (z. B. Buchungsbestätigungen, Support-Anfragen)</li>
                <li>Verbesserung und Weiterentwicklung der Plattform</li>
                <li>Erfüllung gesetzlicher Aufbewahrungs- und Nachweispflichten</li>
                <li>Missbrauchsprävention und Sicherheit der Plattform</li>
              </ul>
            </section>

            {/* §4 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Rechtsgrundlage</h2>
              <p>Die Verarbeitung personenbezogener Daten erfolgt auf folgenden Rechtsgrundlagen:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Art. 6 Abs. 1 lit. b DSGVO:</strong> Vertragserfüllung — Verarbeitung ist für die Durchführung des Nutzungsvertrags erforderlich</li>
                <li><strong>Art. 6 Abs. 1 lit. a DSGVO:</strong> Einwilligung — sofern Sie in bestimmte Verarbeitungen eingewilligt haben</li>
                <li><strong>Art. 6 Abs. 1 lit. c DSGVO:</strong> Rechtliche Verpflichtung — soweit wir gesetzlichen Pflichten nachkommen müssen (z. B. steuerrechtliche Aufbewahrungspflichten)</li>
                <li><strong>Art. 6 Abs. 1 lit. f DSGVO:</strong> Berechtigte Interessen — soweit die Verarbeitung zur Wahrung unserer berechtigten Interessen erforderlich ist (z. B. IT-Sicherheit, Plattformoptimierung)</li>
              </ul>
            </section>

            {/* §5 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Datenweitergabe an Dritte</h2>
              <p>Eine Weitergabe personenbezogener Daten an Dritte erfolgt nur in folgenden Fällen:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Zahlungsdienstleister Mollie B.V.:</strong> Zur Abwicklung von Zahlungen werden die erforderlichen Zahlungsdaten an Mollie B.V. (Keizersgracht 126, 1015 CW Amsterdam, Niederlande) übermittelt. Mollie verarbeitet diese Daten als eigenverantwortlicher Datenverarbeiter gemäß seiner eigenen Datenschutzerklärung.</li>
                <li><strong>Hosting-Provider:</strong> Unsere Server werden bei einem professionellen Hosting-Anbieter in der Europäischen Union betrieben. Mit diesem Anbieter besteht ein Auftragsverarbeitungsvertrag gemäß Art. 28 DSGVO.</li>
                <li><strong>Betreiber-Nutzer:</strong> Die bei einer Buchung angegebenen Kundendaten werden dem jeweiligen Betreiber-Nutzer zur Verfügung gestellt, soweit dies zur Durchführung des Miet-/Nutzungsvertrags erforderlich ist.</li>
                <li><strong>Behörden:</strong> In Fällen gesetzlicher Verpflichtung oder behördlicher Anordnung.</li>
              </ul>
              <p className="mt-2">Eine Übermittlung personenbezogener Daten in Drittländer außerhalb der EU/des EWR findet grundsätzlich nicht statt.</p>
            </section>

            {/* §6 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Speicherdauer</h2>
              <p>Personenbezogene Daten werden nur so lange gespeichert, wie dies für die Erfüllung des jeweiligen Verarbeitungszwecks erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Kontodaten:</strong> Für die Dauer der Nutzung der Plattform und bis zu 30 Tage nach Kontolöschung</li>
                <li><strong>Buchungs- und Vertragsdaten:</strong> 10 Jahre gemäß handels- und steuerrechtlichen Aufbewahrungspflichten (§ 257 HGB, § 147 AO)</li>
                <li><strong>Rechnungsdaten:</strong> 10 Jahre gemäß steuerrechtlichen Aufbewahrungspflichten</li>
                <li><strong>Server-Logfiles:</strong> Maximal 30 Tage</li>
              </ul>
              <p className="mt-2">Nach Ablauf der Speicherdauer werden die Daten gelöscht oder anonymisiert.</p>
            </section>

            {/* §7 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Betroffenenrechte</h2>
              <p>Sie haben folgende Rechte in Bezug auf Ihre personenbezogenen Daten:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Auskunftsrecht (Art. 15 DSGVO):</strong> Sie können Auskunft über Ihre bei uns gespeicherten Daten verlangen.</li>
                <li><strong>Berichtigungsrecht (Art. 16 DSGVO):</strong> Sie können die Berichtigung unrichtiger Daten verlangen.</li>
                <li><strong>Löschungsrecht (Art. 17 DSGVO):</strong> Sie können die Löschung Ihrer Daten verlangen, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</li>
                <li><strong>Einschränkung der Verarbeitung (Art. 18 DSGVO):</strong> Sie können unter bestimmten Voraussetzungen die Einschränkung der Verarbeitung verlangen.</li>
                <li><strong>Datenübertragbarkeit (Art. 20 DSGVO):</strong> Sie können die Herausgabe Ihrer Daten in einem strukturierten, gängigen und maschinenlesbaren Format verlangen.</li>
                <li><strong>Widerspruchsrecht (Art. 21 DSGVO):</strong> Sie können der Verarbeitung Ihrer Daten widersprechen, soweit diese auf Art. 6 Abs. 1 lit. f DSGVO beruht.</li>
                <li><strong>Widerruf der Einwilligung (Art. 7 Abs. 3 DSGVO):</strong> Sie können eine erteilte Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen.</li>
                <li><strong>Beschwerderecht (Art. 77 DSGVO):</strong> Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.</li>
              </ul>
              <p className="mt-2">Zur Ausübung Ihrer Rechte wenden Sie sich bitte an: info@visionmakegpt.work</p>
            </section>

            {/* §8 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Cookies und Tracking</h2>
              <p>(1) Die ParkSaaS-Plattform verwendet ausschließlich technisch notwendige Cookies, die für den Betrieb der Plattform erforderlich sind. Diese Cookies dienen der Aufrechterhaltung der Sitzung (Session-Cookie) und der Speicherung von Authentifizierungsinformationen.</p>
              <p>(2) Es werden keine Tracking-Cookies oder Cookies zu Marketingzwecken eingesetzt.</p>
              <p>(3) Technisch notwendige Cookies werden auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO gesetzt. Unser berechtigtes Interesse liegt in der technisch einwandfreien Bereitstellung der Plattform.</p>
              <p>(4) Sie können Ihren Browser so einstellen, dass Cookies grundsätzlich abgelehnt werden. In diesem Fall kann die Funktionalität der Plattform eingeschränkt sein.</p>
            </section>

            {/* §9 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Änderungen dieser Datenschutzerklärung</h2>
              <p>(1) Wir behalten uns vor, diese Datenschutzerklärung bei Bedarf anzupassen, um sie stets den aktuellen rechtlichen Anforderungen anzupassen oder Änderungen unserer Leistungen umzusetzen.</p>
              <p>(2) Für Ihren nächsten Besuch gilt jeweils die aktuelle Datenschutzerklärung.</p>
              <p>(3) Bei wesentlichen Änderungen, die Ihre Rechte betreffen, werden registrierte Nutzer per E-Mail informiert.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Auftragsverarbeitung</h2>
              <p>Sofern Betreiber-Nutzer über ParkSaaS personenbezogene Daten ihrer Kunden verarbeiten, stellt ParkSaaS einen Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28 DSGVO bereit. Dieser ist unter <Link to="/avv" className="text-emerald-600 hover:underline">Auftragsverarbeitungsvertrag</Link> einsehbar und wird im Rahmen des Onboarding-Prozesses akzeptiert.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
