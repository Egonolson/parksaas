import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'

const DURATION_TYPES = {
  '30min': '30 Minuten',
  '1h': '1 Stunde',
  '2h': '2 Stunden',
  '4h': '4 Stunden',
  'daily': 'Tagesticket',
  'weekly': 'Wochenpass',
  'monthly': 'Monatsmiete',
  'yearly': 'Jahresmiete',
}

export default function Settings() {
  const { operator, updateOperator } = useAuth()
  const [profileForm, setProfileForm] = useState({
    company_name: operator?.company_name || '',
    email: operator?.email || '',
    phone: operator?.phone || '',
    address: operator?.address || '',
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState(null)

  const [commissionRate, setCommissionRate] = useState(operator?.commission_rate || 3)

  // Duration management state
  const [locations, setLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState(null)
  const [durations, setDurations] = useState([])
  const [durationsLoading, setDurationsLoading] = useState(false)
  const [showDurationForm, setShowDurationForm] = useState(false)
  const [newDuration, setNewDuration] = useState({ duration_type: '30min', price: '' })
  const [durationSaving, setDurationSaving] = useState(false)
  const [durationError, setDurationError] = useState(null)

  // Booking config state
  const [bookingLocationId, setBookingLocationId] = useState(null)
  const [bookingConfig, setBookingConfig] = useState({
    primary_color: '#059669',
    accent_color: '#10b981',
    background_color: '#f9fafb',
    text_color: '#111827',
    welcome_text: '',
    button_text: 'Jetzt buchen',
    custom_css: '',
    hide_branding: false,
  })
  const [bookingSaving, setBookingSaving] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [bookingError, setBookingError] = useState(null)
  const [embedCopied, setEmbedCopied] = useState(false)

  const loadDurations = useCallback(async (locationId) => {
    if (!locationId) return
    setDurationsLoading(true)
    setDurationError(null)
    try {
      const res = await api.get(`/locations/${locationId}/durations`)
      setDurations(res.data.durations || res.data || [])
    } catch {
      setDurations([])
      setDurationError('Fehler beim Laden der Parkdauern')
    } finally {
      setDurationsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Fetch current operator info
    api.get('/operators/me')
      .then(res => {
        const data = res.data
        setProfileForm({
          company_name: data.company_name || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
        })
        setCommissionRate(data.commission_rate || 3)
      })
      .catch(() => {})

    // Load locations for duration management
    api.get('/locations')
      .then(res => {
        const locs = res.data.locations || res.data || []
        setLocations(locs)
        if (locs.length > 0) {
          setSelectedLocationId(locs[0].id)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedLocationId) {
      loadDurations(selectedLocationId)
    }
  }, [selectedLocationId, loadDurations])

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileError(null)
    try {
      const res = await api.put('/operators/me', profileForm)
      updateOperator(res.data)
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Fehler beim Speichern')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleAddDuration = async (e) => {
    e.preventDefault()
    if (!selectedLocationId || !newDuration.price) return
    setDurationSaving(true)
    setDurationError(null)
    try {
      await api.post(`/locations/${selectedLocationId}/durations`, {
        duration_type: newDuration.duration_type,
        price: parseFloat(newDuration.price),
      })
      setNewDuration({ duration_type: '30min', price: '' })
      setShowDurationForm(false)
      loadDurations(selectedLocationId)
    } catch (err) {
      setDurationError(err.response?.data?.message || 'Fehler beim Speichern der Parkdauer')
    } finally {
      setDurationSaving(false)
    }
  }

  const handleDeleteDuration = async (durationId) => {
    if (!confirm('Parkdauer wirklich löschen?')) return
    try {
      await api.delete(`/locations/${selectedLocationId}/durations/${durationId}`)
      loadDurations(selectedLocationId)
    } catch {
      setDurationError('Fehler beim Löschen der Parkdauer')
    }
  }

  // Booking config functions
  const loadBookingConfig = useCallback(async (locationId) => {
    if (!locationId) return
    try {
      const res = await api.get(`/locations/${locationId}/booking-config`)
      const cfg = res.data || {}
      setBookingConfig({
        primary_color: cfg.primary_color || '#059669',
        accent_color: cfg.accent_color || '#10b981',
        background_color: cfg.background_color || '#f9fafb',
        text_color: cfg.text_color || '#111827',
        welcome_text: cfg.welcome_text || '',
        button_text: cfg.button_text || 'Jetzt buchen',
        custom_css: cfg.custom_css || '',
        hide_branding: cfg.hide_branding || false,
      })
    } catch {
      // defaults are fine
    }
  }, [])

  useEffect(() => {
    if (bookingLocationId) {
      loadBookingConfig(bookingLocationId)
    }
  }, [bookingLocationId, loadBookingConfig])

  // Set initial booking location when locations load
  useEffect(() => {
    if (locations.length > 0 && !bookingLocationId) {
      setBookingLocationId(locations[0].id)
    }
  }, [locations, bookingLocationId])

  const handleBookingSave = async () => {
    if (!bookingLocationId) return
    setBookingSaving(true)
    setBookingError(null)
    try {
      await api.put(`/locations/${bookingLocationId}/booking-config`, bookingConfig)
      setBookingSuccess(true)
      setTimeout(() => setBookingSuccess(false), 3000)
    } catch (err) {
      setBookingError(err.response?.data?.message || 'Fehler beim Speichern')
    } finally {
      setBookingSaving(false)
    }
  }

  const bookingEmbedCode = bookingLocationId
    ? `<iframe src="https://parking.visionmakegpt.work/embed/${bookingLocationId}" width="100%" height="600" frameborder="0"></iframe>`
    : ''

  const copyBookingEmbed = () => {
    navigator.clipboard.writeText(bookingEmbedCode)
    setEmbedCopied(true)
    setTimeout(() => setEmbedCopied(false), 2000)
  }

  const formatPrice = (amount) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        <p className="text-gray-500 text-sm mt-1">Verwalten Sie Ihr Konto und Zahlungseinstellungen</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Transaktionsgebühr */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Transaktionsgebühr</h2>
          <p className="text-gray-500 text-sm mb-4">
            ParkSaaS erhebt eine kleine Gebühr auf alle verarbeiteten Zahlungen.
          </p>
          <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <span className="text-emerald-700 font-bold text-lg">{commissionRate}%</span>
            </div>
            <div>
              <p className="font-semibold text-emerald-800">Ihr aktueller Satz: {commissionRate}%</p>
              <p className="text-emerald-600 text-xs mt-0.5">
                Bei EUR 100 Zahlung behalten wir EUR {(commissionRate).toFixed(2)} als Transaktionsgebühr.
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Für angepasste Konditionen wenden Sie sich bitte an support@parksaas.de
          </p>
        </div>

        {/* Parking Duration & Prices */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Parkdauer & Preise</h2>
          <p className="text-gray-500 text-sm mb-5">
            Konfigurieren Sie verfügbare Parkdauern und Preise pro Standort.
          </p>

          {locations.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <p>Keine Standorte vorhanden. Erstellen Sie zuerst einen Standort.</p>
            </div>
          ) : (
            <>
              {/* Location selector */}
              <div className="mb-5">
                <label className="label">Standort</label>
                <select
                  className="input-field"
                  value={selectedLocationId || ''}
                  onChange={e => setSelectedLocationId(Number(e.target.value))}
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.address ? `- ${loc.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {durationError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
                  {durationError}
                </div>
              )}

              {/* Durations list */}
              {durationsLoading ? (
                <div className="text-center py-6 text-gray-400 text-sm">Lade Parkdauern...</div>
              ) : durations.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg mb-4">
                  Noch keine Parkdauern konfiguriert.
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {durations.map(d => (
                    <div key={d.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {DURATION_TYPES[d.duration_type] || d.duration_type}
                          </p>
                          <p className="text-xs text-gray-500">{formatPrice(d.price)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteDuration(d.id)}
                        className="text-red-400 hover:text-red-600 transition-colors p-1"
                        title="Löschen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add duration form */}
              {showDurationForm ? (
                <form onSubmit={handleAddDuration} className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Parkdauer</label>
                      <select
                        className="input-field"
                        value={newDuration.duration_type}
                        onChange={e => setNewDuration(p => ({ ...p, duration_type: e.target.value }))}
                      >
                        {Object.entries(DURATION_TYPES).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Preis (EUR)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input-field"
                        value={newDuration.price}
                        onChange={e => setNewDuration(p => ({ ...p, price: e.target.value }))}
                        placeholder="z.B. 3.50"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={durationSaving}
                      className="btn-primary text-sm"
                    >
                      {durationSaving ? 'Speichern...' : 'Speichern'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDurationForm(false); setDurationError(null) }}
                      className="btn-secondary text-sm"
                    >
                      Abbrechen
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowDurationForm(true)}
                  className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Dauer hinzufügen
                </button>
              )}
            </>
          )}
        </div>

        {/* Buchungsseite konfigurieren */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Buchungsseite konfigurieren</h2>
          <p className="text-gray-500 text-sm mb-5">
            Passen Sie das Erscheinungsbild Ihrer Buchungsseite an.
          </p>

          {locations.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <p>Keine Standorte vorhanden. Erstellen Sie zuerst einen Standort.</p>
            </div>
          ) : (
            <>
              {/* Location selector */}
              <div className="mb-5">
                <label className="label">Standort</label>
                <select
                  className="input-field"
                  value={bookingLocationId || ''}
                  onChange={e => setBookingLocationId(Number(e.target.value))}
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.address ? `- ${loc.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {bookingSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm mb-4">
                  Buchungsseite erfolgreich gespeichert!
                </div>
              )}
              {bookingError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
                  {bookingError}
                </div>
              )}

              {/* Colors */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {[
                  { key: 'primary_color', label: 'Primärfarbe' },
                  { key: 'accent_color', label: 'Akzentfarbe' },
                  { key: 'background_color', label: 'Hintergrund' },
                  { key: 'text_color', label: 'Textfarbe' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={bookingConfig[key]}
                        onChange={e => setBookingConfig(p => ({ ...p, [key]: e.target.value }))}
                        className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={bookingConfig[key]}
                        onChange={e => setBookingConfig(p => ({ ...p, [key]: e.target.value }))}
                        className="input-field text-xs font-mono flex-1"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Texts */}
              <div className="space-y-4 mb-5">
                <div>
                  <label className="label">Begrüßungstext</label>
                  <input
                    className="input-field"
                    value={bookingConfig.welcome_text}
                    onChange={e => setBookingConfig(p => ({ ...p, welcome_text: e.target.value }))}
                    placeholder="Willkommen! Buchen Sie hier Ihren Stellplatz."
                  />
                </div>
                <div>
                  <label className="label">Button-Text</label>
                  <input
                    className="input-field"
                    value={bookingConfig.button_text}
                    onChange={e => setBookingConfig(p => ({ ...p, button_text: e.target.value }))}
                    placeholder="Jetzt buchen"
                  />
                </div>
                <div>
                  <label className="label">Eigenes CSS (optional)</label>
                  <textarea
                    className="input-field font-mono text-xs"
                    rows={3}
                    value={bookingConfig.custom_css}
                    onChange={e => setBookingConfig(p => ({ ...p, custom_css: e.target.value }))}
                    placeholder="/* Eigenes CSS */"
                  />
                </div>
              </div>

              {/* Hide branding toggle */}
              <div className="mb-5">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`relative w-10 h-6 rounded-full transition-colors ${bookingConfig.hide_branding ? 'bg-emerald-600' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${bookingConfig.hide_branding ? 'translate-x-4' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-700">ParkSaaS-Branding ausblenden</span>
                </label>
              </div>

              {/* Preview & Embed */}
              <div className="flex items-center gap-3 mb-5">
                {operator?.slug && (
                  <a
                    href={`/park/${operator.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-sm"
                  >
                    Vorschau öffnen ↗
                  </a>
                )}
              </div>

              {/* Embed Code */}
              {bookingLocationId && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5">
                  <p className="text-sm font-medium text-gray-700 mb-2">Embed-Code (iFrame)</p>
                  <div className="relative">
                    <pre className="bg-gray-900 text-emerald-400 rounded-lg p-3 text-xs overflow-x-auto font-mono">
                      {bookingEmbedCode}
                    </pre>
                    <button
                      onClick={copyBookingEmbed}
                      className="absolute top-1.5 right-1.5 bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs transition-colors"
                    >
                      {embedCopied ? '✓ Kopiert!' : 'Kopieren'}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleBookingSave}
                disabled={bookingSaving}
                className="btn-primary"
              >
                {bookingSaving ? 'Speichern...' : 'Buchungsseite speichern'}
              </button>
            </>
          )}
        </div>

        {/* DATEV-Anbindung */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">DATEV-Anbindung</h2>
          <p className="text-gray-500 text-sm mb-4">
            Verbinden Sie Ihr DATEV-Konto für automatischen Belegexport.
          </p>
          <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl mb-4">
            <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-gray-700 font-semibold text-sm">Noch nicht konfiguriert</p>
              <p className="text-gray-500 text-xs mt-0.5">DATEV-Verbindung ist noch nicht eingerichtet.</p>
            </div>
          </div>
          <button
            disabled
            className="bg-gray-200 text-gray-500 px-4 py-2.5 rounded-xl font-semibold text-sm cursor-not-allowed"
          >
            DATEV konfigurieren (coming soon)
          </button>
        </div>

        {/* Rechnungsstellung */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Rechnungsstellung</h2>
          <p className="text-gray-500 text-sm mb-4">
            Rechnungen werden automatisch im Namen Ihres Unternehmens erstellt.
          </p>
          <div className="space-y-3 mb-4">
            <div>
              <label className="label">Firmenname</label>
              <input
                className="input-field"
                value={profileForm.company_name}
                onChange={e => setProfileForm(p => ({ ...p, company_name: e.target.value }))}
                placeholder="Ihr Firmenname"
              />
            </div>
            <div>
              <label className="label">Adresse</label>
              <input
                className="input-field"
                value={profileForm.address}
                onChange={e => setProfileForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Straße, PLZ, Stadt"
              />
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            Stellen Sie sicher, dass Ihre Unternehmensdaten korrekt sind.
          </div>
        </div>

        {/* Booking URL */}
        {operator?.slug && (
          <div className="card p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Ihre Buchungsseite</h2>
            <p className="text-gray-500 text-sm mb-4">Teilen Sie diese URL mit Ihren Kunden.</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-700 truncate">
                parksaas.de/park/{operator.slug}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/park/${operator.slug}`)
                  alert('URL kopiert!')
                }}
                className="btn-secondary shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <a
                href={`/park/${operator.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary shrink-0"
              >
                Öffnen
              </a>
            </div>
          </div>
        )}

        {/* Profile */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Profil-Daten</h2>
          <p className="text-gray-500 text-sm mb-5">Aktualisieren Sie Ihre Kontodaten.</p>

          {profileSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm mb-4">
              Profil erfolgreich gespeichert!
            </div>
          )}
          {profileError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
              {profileError}
            </div>
          )}

          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label className="label">Firmenname</label>
              <input
                className="input-field"
                value={profileForm.company_name}
                onChange={e => setProfileForm(p => ({ ...p, company_name: e.target.value }))}
                placeholder="Ihr Firmenname"
              />
            </div>
            <div>
              <label className="label">E-Mail</label>
              <input
                type="email"
                className="input-field"
                value={profileForm.email}
                onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))}
                placeholder="ihre@email.de"
              />
            </div>
            <div>
              <label className="label">Telefon (optional)</label>
              <input
                className="input-field"
                value={profileForm.phone}
                onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+49 170 1234567"
              />
            </div>
            <div className="pt-2">
              <button type="submit" disabled={profileSaving} className="btn-primary">
                {profileSaving ? 'Speichern...' : 'Profil speichern'}
              </button>
            </div>
          </form>
        </div>

        {/* Danger Zone */}
        <div className="card p-6 border-red-100">
          <h2 className="font-semibold text-red-700 mb-1">Gefahrenzone</h2>
          <p className="text-gray-500 text-sm mb-4">
            Diese Aktionen können nicht rückgängig gemacht werden.
          </p>
          <button
            onClick={() => confirm('Konto wirklich löschen? Diese Aktion ist permanent.') && alert('Bitte kontaktieren Sie support@parksaas.de')}
            className="btn-danger"
          >
            Konto löschen
          </button>
        </div>
      </div>
    </div>
  )
}
