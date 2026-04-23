import { Link } from 'react-router-dom'

export default function AGB() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Allgemeine Geschäftsbedingungen (AGB)</h1>
          <p className="text-gray-500 text-sm mb-8">Stand: April 2026</p>

          <div className="prose prose-gray max-w-none space-y-8 text-gray-700 text-sm leading-relaxed">
            {/* §1 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 1 Geltungsbereich</h2>
              <p>(1) Diese Allgemeinen Geschäftsbedingungen (nachfolgend „AGB") gelten für alle Verträge, die zwischen ParkSaaS, betrieben von Vision X Digital, Sebastian Hendrich, Berliner Str. 14, 07545 Gera (nachfolgend „Betreiber" oder „ParkSaaS") und den Nutzern der Plattform (nachfolgend „Nutzer") geschlossen werden.</p>
              <p>(2) Die Plattform ParkSaaS stellt eine Software-as-a-Service-Lösung zur Verwaltung und Vermietung von Parkplätzen bereit. Nutzer können sowohl Parkplatzbetreiber (nachfolgend „Betreiber-Nutzer") als auch Endkunden (nachfolgend „Kunden") sein.</p>
              <p>(3) Abweichende, entgegenstehende oder ergänzende Allgemeine Geschäftsbedingungen des Nutzers werden nur dann Vertragsbestandteil, wenn ParkSaaS ihrer Geltung ausdrücklich schriftlich zugestimmt hat.</p>
              <p>(4) Diese AGB gelten in der zum Zeitpunkt der Registrierung bzw. des Vertragsschlusses gültigen Fassung.</p>
            </section>

            {/* §2 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 2 Vertragsgegenstand</h2>
              <p>(1) Gegenstand des Vertrages ist die Bereitstellung der ParkSaaS-Plattform zur Nutzung über das Internet. Die Plattform ermöglicht Betreiber-Nutzern die digitale Verwaltung ihrer Parkflächen, die Erstellung von Buchungsseiten, die Abwicklung von Zahlungen sowie die Verwaltung von Mietverträgen für Stellplätze.</p>
              <p>(2) ParkSaaS stellt die technische Infrastruktur bereit, einschließlich Hosting, Datenspeicherung, Zahlungsintegration und Kommunikationsfunktionen. ParkSaaS ist selbst kein Vertragspartner der zwischen Betreiber-Nutzern und Kunden geschlossenen Miet- oder Nutzungsverträge.</p>
              <p>(3) Der genaue Leistungsumfang ergibt sich aus der jeweils aktuellen Leistungsbeschreibung auf der Webseite von ParkSaaS.</p>
            </section>

            {/* §3 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 3 Registrierung und Nutzerkonto</h2>
              <p>(1) Die Nutzung der Plattform setzt eine Registrierung voraus. Betreiber-Nutzer müssen bei der Registrierung wahrheitsgemäße und vollständige Angaben machen, insbesondere Firmenname, E-Mail-Adresse und gewählten URL-Slug.</p>
              <p>(2) Jeder Nutzer darf nur ein Konto erstellen. Die Zugangsdaten sind vertraulich zu behandeln und dürfen Dritten nicht zugänglich gemacht werden.</p>
              <p>(3) ParkSaaS behält sich das Recht vor, Registrierungen ohne Angabe von Gründen abzulehnen oder bestehende Konten bei Verstoß gegen diese AGB zu sperren oder zu löschen.</p>
              <p>(4) Der Nutzer ist verpflichtet, seine Zugangsdaten geheim zu halten und ParkSaaS unverzüglich zu informieren, wenn er Kenntnis davon erlangt, dass Dritte seine Zugangsdaten missbrauchen.</p>
            </section>

            {/* §4 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 4 Leistungen von ParkSaaS</h2>
              <p>(1) ParkSaaS stellt Betreiber-Nutzern folgende Leistungen bereit:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Verwaltung von Standorten und Stellplätzen</li>
                <li>Erstellung individueller Buchungsseiten mit eigenem Branding</li>
                <li>Integration von Zahlungsabwicklung über den Zahlungsdienstleister Mollie</li>
                <li>Verwaltung von Mietverträgen und Buchungen</li>
                <li>Kundenportal für Endkunden</li>
                <li>Einbettung der Buchungsseite per iFrame auf der eigenen Website</li>
                <li>Automatische Rechnungserstellung</li>
                <li>DATEV-Schnittstelle (sofern verfügbar)</li>
              </ul>
              <p>(2) ParkSaaS bemüht sich um eine Verfügbarkeit der Plattform von 99,5 % im Jahresmittel. Geplante Wartungsarbeiten werden nach Möglichkeit vorab angekündigt.</p>
              <p>(3) ParkSaaS behält sich vor, den Funktionsumfang der Plattform jederzeit zu erweitern, einzuschränken oder anzupassen, soweit dadurch der Vertragszweck nicht wesentlich beeinträchtigt wird.</p>
            </section>

            {/* §5 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 5 Zahlungsabwicklung</h2>
              <p>(1) Die Zahlungsabwicklung zwischen Kunden und Betreiber-Nutzern erfolgt über den externen Zahlungsdienstleister Mollie B.V. ParkSaaS ist an der Zahlungsabwicklung lediglich als technischer Vermittler beteiligt.</p>
              <p>(2) Der Betreiber-Nutzer ist verpflichtet, ein eigenes Mollie-Konto einzurichten oder die von ParkSaaS bereitgestellte Zahlungsinfrastruktur zu nutzen.</p>
              <p>(3) ParkSaaS übernimmt keine Haftung für Störungen, Ausfälle oder Verzögerungen in der Zahlungsabwicklung, die auf den Zahlungsdienstleister zurückzuführen sind.</p>
              <p>(4) Die Auszahlung an Betreiber-Nutzer erfolgt nach Abzug der Transaktionsgebühr gemäß § 6 dieser AGB.</p>
            </section>

            {/* §6 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 6 Transaktionsgebühren</h2>
              <p>(1) ParkSaaS erhebt für jede über die Plattform verarbeitete Zahlung eine Transaktionsgebühr. Die Höhe der Transaktionsgebühr wird dem Betreiber-Nutzer bei der Registrierung bzw. in den Kontoeinstellungen mitgeteilt.</p>
              <p>(2) Die standardmäßige Transaktionsgebühr beträgt 3 % des Brutto-Zahlungsbetrags, sofern nicht individuell anders vereinbart.</p>
              <p>(3) Die Transaktionsgebühr wird automatisch bei der Auszahlung an den Betreiber-Nutzer einbehalten.</p>
              <p>(4) Änderungen der Transaktionsgebühr werden dem Betreiber-Nutzer mindestens 30 Tage vor Inkrafttreten schriftlich (per E-Mail) mitgeteilt. Der Betreiber-Nutzer hat in diesem Fall ein Sonderkündigungsrecht zum Zeitpunkt des Inkrafttretens der Änderung.</p>
            </section>

            {/* §7 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 7 Pflichten des Betreiber-Nutzers</h2>
              <p>(1) Der Betreiber-Nutzer verpflichtet sich, die Plattform nur im Rahmen der geltenden Gesetze und dieser AGB zu nutzen.</p>
              <p>(2) Der Betreiber-Nutzer ist für die Richtigkeit und Aktualität der von ihm eingestellten Daten (Standorte, Preise, Stellplatzinformationen) verantwortlich.</p>
              <p>(3) Der Betreiber-Nutzer ist verpflichtet, die über die Plattform eingehenden Buchungen ordnungsgemäß zu bearbeiten und die gebuchten Stellplätze bereitzustellen.</p>
              <p>(4) Der Betreiber-Nutzer stellt ParkSaaS von sämtlichen Ansprüchen Dritter frei, die aus einer rechtswidrigen Nutzung der Plattform durch den Betreiber-Nutzer resultieren.</p>
              <p>(5) Der Betreiber-Nutzer ist für die Einhaltung aller steuer- und gewerberechtlichen Pflichten im Zusammenhang mit seiner Parkplatzvermietung selbst verantwortlich.</p>
            </section>

            {/* §8 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 8 Pflichten des Kunden</h2>
              <p>(1) Der Kunde verpflichtet sich, bei der Buchung wahrheitsgemäße und vollständige Angaben zu machen.</p>
              <p>(2) Der Kunde hat die Zahlungspflichten aus der Buchung fristgerecht zu erfüllen.</p>
              <p>(3) Der Kunde ist verpflichtet, den gebuchten Stellplatz nur im vereinbarten Zeitraum zu nutzen und die Hausordnung des jeweiligen Parkplatzbetreibers zu beachten.</p>
              <p>(4) Bei missbräuchlicher Nutzung behält sich ParkSaaS das Recht vor, den Zugang des Kunden zur Plattform einzuschränken oder zu sperren.</p>
            </section>

            {/* §9 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 9 Haftung</h2>
              <p>(1) ParkSaaS haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, die auf einer vorsätzlichen oder fahrlässigen Pflichtverletzung von ParkSaaS beruhen.</p>
              <p>(2) Für sonstige Schäden haftet ParkSaaS nur bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung wesentlicher Vertragspflichten (Kardinalpflichten). Bei der Verletzung von Kardinalpflichten ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden beschränkt.</p>
              <p>(3) ParkSaaS haftet nicht für die zwischen Betreiber-Nutzern und Kunden geschlossenen Verträge. ParkSaaS ist nicht Vertragspartner dieser Verträge und übernimmt keine Gewährleistung für die Qualität, Verfügbarkeit oder Eignung der angebotenen Stellplätze.</p>
              <p>(4) ParkSaaS haftet nicht für Schäden, die durch höhere Gewalt, Störungen der Telekommunikationsnetze oder des Internets entstehen, soweit diese außerhalb des Einflussbereichs von ParkSaaS liegen.</p>
              <p>(5) Die vorstehenden Haftungsbeschränkungen gelten auch zugunsten der Erfüllungsgehilfen von ParkSaaS.</p>
            </section>

            {/* §10 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 10 Datenschutz</h2>
              <p>(1) ParkSaaS verarbeitet personenbezogene Daten der Nutzer gemäß den geltenden datenschutzrechtlichen Bestimmungen, insbesondere der Datenschutz-Grundverordnung (DSGVO) und des Bundesdatenschutzgesetzes (BDSG).</p>
              <p>(2) Details zur Datenverarbeitung sind in der separaten Datenschutzerklärung beschrieben, die unter <Link to="/datenschutz" className="text-emerald-600 hover:underline">Datenschutzerklärung</Link> abrufbar ist.</p>
              <p>(3) Soweit Betreiber-Nutzer über die Plattform personenbezogene Daten von Kunden verarbeiten, handeln sie als Verantwortliche im Sinne der DSGVO. ParkSaaS stellt hierfür einen Auftragsverarbeitungsvertrag gemäß Art. 28 DSGVO bereit.</p>
            </section>

            {/* §11 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 11 Laufzeit und Kündigung</h2>
              <p>(1) Der Vertrag zwischen ParkSaaS und dem Betreiber-Nutzer wird auf unbestimmte Zeit geschlossen und kann von beiden Seiten mit einer Frist von 30 Tagen zum Monatsende gekündigt werden.</p>
              <p>(2) Das Recht zur fristlosen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt insbesondere vor, wenn:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>der Nutzer gegen wesentliche Bestimmungen dieser AGB verstößt,</li>
                <li>der Nutzer die Plattform für rechtswidrige Zwecke nutzt,</li>
                <li>der Nutzer trotz Mahnung fällige Zahlungen nicht leistet.</li>
              </ul>
              <p>(3) Im Falle der Kündigung werden die Daten des Nutzers nach Ablauf gesetzlicher Aufbewahrungsfristen gelöscht, sofern keine gesetzliche Pflicht zur weiteren Speicherung besteht.</p>
              <p>(4) Der Kunde kann sein Kundenkonto jederzeit löschen. Laufende Buchungen und Verträge bleiben hiervon unberührt.</p>
            </section>

            {/* §12 */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">§ 12 Schlussbestimmungen</h2>
              <p>(1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.</p>
              <p>(2) Ist der Nutzer Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem Vertrag der Sitz von ParkSaaS.</p>
              <p>(3) Sollten einzelne Bestimmungen dieser AGB unwirksam oder undurchführbar sein oder werden, so bleibt die Wirksamkeit der übrigen Bestimmungen davon unberührt. An die Stelle der unwirksamen oder undurchführbaren Bestimmung soll diejenige wirksame und durchführbare Regelung treten, deren Wirkungen der wirtschaftlichen Zielsetzung am nächsten kommen.</p>
              <p>(4) ParkSaaS behält sich das Recht vor, diese AGB jederzeit mit Wirkung für die Zukunft zu ändern. Über Änderungen wird der Nutzer per E-Mail informiert. Die Änderungen gelten als genehmigt, wenn der Nutzer nicht innerhalb von 30 Tagen nach Zugang der Änderungsmitteilung widerspricht.</p>
              <p>(5) Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">https://ec.europa.eu/consumers/odr</a>. ParkSaaS ist weder bereit noch verpflichtet, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
