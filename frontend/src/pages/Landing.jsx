import { Link } from 'react-router-dom'

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Multi-Standort Verwaltung',
    desc: 'Verwalten Sie alle Ihre Parkplätze an verschiedenen Standorten zentral in einem Dashboard.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    title: 'Automatische Zahlungsabwicklung',
    desc: 'Zahlungen werden automatisch abgewickelt. Wir übernehmen die komplette Zahlungsabwicklung für Sie – kein manueller Aufwand.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Übersichtliches Dashboard',
    desc: 'Alle wichtigen Kennzahlen auf einen Blick: Auslastung, Umsatz, offene Zahlungen.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    title: 'Eigene Buchungsseite',
    desc: 'Jeder Betreiber erhält eine individuelle URL. Kunden können direkt online buchen.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'DATEV-Schnittstelle',
    desc: 'Nahtlose Integration mit DATEV für Ihre Buchhaltung. Rechnungen und Belege werden automatisch übertragen.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
      </svg>
    ),
    title: 'Rechnungsstellung',
    desc: 'Automatische Rechnungserstellung im Namen des Betreibers. Jede Transaktion wird sauber dokumentiert.',
  },
]

const PRICING = [
  {
    name: 'Professional',
    price: '0',
    priceLabel: 'EUR 0 / kostenlos',
    period: '',
    badge: 'Empfohlen',
    features: [
      'Unbegrenzte Stellplätze',
      'Unbegrenzte Standorte',
      'Zahlungsabwicklung inklusive',
      'DATEV-Schnittstelle',
      'Automatische Rechnungen',
      'E-Mail Support',
    ],
    note: 'Nur eine kleine Gebühr pro Zahlungsabwicklung',
    cta: 'Kostenlos starten',
    ctaLink: '/register',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Auf Anfrage',
    priceLabel: 'Auf Anfrage',
    period: '',
    badge: null,
    features: [
      'Alles aus Professional',
      'White-Label Option',
      'Dedicated Support',
      'SLA-Garantie',
      'Custom Integrations',
      'Individuelle Konditionen',
    ],
    note: null,
    cta: 'Kontakt aufnehmen',
    ctaLink: '/register',
    highlighted: false,
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <span className="text-emerald-800 font-bold text-xl">ParkSaaS</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Features</a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Preise</a>
            <Link to="/kunde/login" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Kundenportal</Link>
            <Link to="/login" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Anmelden</Link>
            <Link to="/register" className="btn-primary">Kostenlos starten</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-700 to-cyan-700 text-white">
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
            Ihr Parkplatz.
            <br />
            <span className="text-emerald-300">Professionell verwaltet.</span>
          </h1>
          <p className="text-xl text-emerald-100 max-w-2xl mx-auto mb-10 leading-relaxed">
            ParkSaaS ist die All-in-One Plattform für Parkplatzbetreiber.
            Verwalten Sie Stellplätze, Verträge und Zahlungen an einem Ort.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-white text-emerald-800 px-8 py-4 rounded-xl font-semibold hover:bg-emerald-50 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Kostenlos starten
            </Link>
            <a
              href="#features"
              className="border border-emerald-400 text-white px-8 py-4 rounded-xl font-semibold hover:bg-emerald-800 transition-colors"
            >
              Mehr erfahren
            </a>
          </div>
          <p className="text-emerald-300 text-sm mt-6">Keine Kreditkarte erforderlich &bull; Sofort einsatzbereit</p>
        </div>

        {/* Mock Dashboard Preview */}
        <div className="max-w-5xl mx-auto px-6 pb-0">
          <div className="bg-white rounded-t-2xl shadow-2xl overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center gap-2 border-b">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-gray-400 text-xs ml-2">parksaas.de/dashboard</span>
            </div>
            <div className="p-6 bg-gray-50">
              <div className="grid grid-cols-4 gap-3 mb-4">
                {['12 Verträge', '8 Frei', '2.400 EUR', '3 Ausstehend'].map((stat, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-400 mb-1">
                      {['Aktiv', 'Spots', 'Umsatz', 'Pending'][i]}
                    </div>
                    <div className="font-bold text-gray-800 text-sm">{stat}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Letzte Zahlungen</div>
                {['Max Mustermann', 'Anna Schmidt', 'Tom Weber'].map((name, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-700">{name}</span>
                    <span className="text-xs font-medium text-green-600">120,00 EUR</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Alles was Sie brauchen</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Von der Buchung bis zur Abrechnung – ParkSaaS deckt den gesamten Prozess ab.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="p-6 rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Transparente Preise</h2>
            <p className="text-gray-500 text-lg">Starten Sie kostenlos – Sie zahlen nur eine kleine Gebühr pro Zahlungsabwicklung.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {PRICING.map((plan, i) => (
              <div
                key={i}
                className={`rounded-2xl p-8 ${
                  plan.highlighted
                    ? 'bg-emerald-700 text-white shadow-xl ring-4 ring-emerald-300/30'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <h3 className={`text-lg font-semibold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {plan.name}
                  </h3>
                  {plan.badge && (
                    <span className="bg-emerald-300 text-emerald-900 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {plan.badge}
                    </span>
                  )}
                </div>
                <div className="mb-6">
                  <span className={`text-3xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {plan.priceLabel}
                  </span>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-sm">
                      <svg className={`w-4 h-4 shrink-0 ${plan.highlighted ? 'text-emerald-300' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={plan.highlighted ? 'text-emerald-100' : 'text-gray-600'}>{f}</span>
                    </li>
                  ))}
                </ul>
                {plan.note && (
                  <p className={`text-xs mb-6 ${plan.highlighted ? 'text-emerald-200' : 'text-gray-400'}`}>
                    {plan.note}
                  </p>
                )}
                <Link
                  to={plan.ctaLink}
                  className={`block text-center py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 ${
                    plan.highlighted
                      ? 'bg-white text-emerald-700 hover:bg-emerald-50 shadow-sm hover:shadow-md'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="gradient-hero text-white text-center py-20">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-4">Bereit loszulegen?</h2>
          <p className="text-emerald-200 mb-8 text-lg">
            Registrieren Sie sich in 2 Minuten und verwalten Sie Ihre Parkplätze noch heute professionell.
          </p>
          <Link
            to="/register"
            className="inline-block bg-white text-emerald-800 px-10 py-4 rounded-xl font-semibold hover:bg-emerald-50 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Kostenlos starten
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-600 rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <span className="text-white font-semibold">ParkSaaS</span>
          </div>
          <p className="text-sm">&copy; 2026 ParkSaaS. Alle Rechte vorbehalten.</p>
          <div className="flex gap-4 text-sm">
            <Link to="/kunde/login" className="hover:text-white transition-colors">Kundenportal</Link>
            <Link to="/datenschutz" className="hover:text-white transition-colors">Datenschutz</Link>
            <Link to="/impressum" className="hover:text-white transition-colors">Impressum</Link>
            <Link to="/agb" className="hover:text-white transition-colors">AGB</Link>
            <Link to="/admin/login" className="text-gray-600 hover:text-gray-400 transition-colors">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
