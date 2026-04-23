import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'

const STEPS = [
  { key: 'welcome', label: 'Willkommen' },
  { key: 'legal', label: 'Rechtliches' },
  { key: 'location', label: 'Erster Standort' },
  { key: 'spots', label: 'Stellplätze & Parkdauern' },
  { key: 'booking', label: 'Buchungsseite' },
]

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

export default function Onboarding() {
  const { operator, updateOperator } = useAuth()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Step 2: Legal
  const [legal, setLegal] = useState({ agb: false, datenschutz: false, avv: false })

  // Step 3: Location
  const [locationForm, setLocationForm] = useState({ name: '', address: '', zip: '', city: '' })
  const [createdLocation, setCreatedLocation] = useState(null)
  const [locationErrors, setLocationErrors] = useState({})

  // Step 4: Spots & Durations
  const [spotForm, setSpotForm] = useState({ prefix: 'P', from: '1', to: '10', price: '50' })
  const [spotsCreated, setSpotsCreated] = useState(false)
  const [durations, setDurations] = useState([])
  const [newDuration, setNewDuration] = useState({ duration_type: '30min', price: '' })
  const [durationSaving, setDurationSaving] = useState(false)

  // Step 5: Booking config
  const [bookingConfig, setBookingConfig] = useState({
    primary_color: '#059669',
    accent_color: '#10b981',
    background_color: '#f9fafb',
    text_color: '#111827',
    welcome_text: 'Willkommen! Buchen Sie hier Ihren Stellplatz.',
    button_text: 'Jetzt buchen',
    custom_css: '',
  })
  const [embedCopied, setEmbedCopied] = useState(false)

  const formatPrice = (amount) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)

  // Load durations for created location
  const loadDurations = useCallback(async (locationId) => {
    if (!locationId) return
    try {
      const res = await api.get(`/locations/${locationId}/durations`)
      setDurations(res.data.durations || res.data || [])
    } catch {
      setDurations([])
    }
  }, [])

  useEffect(() => {
    if (createdLocation?.id) {
      loadDurations(createdLocation.id)
    }
  }, [createdLocation, loadDurations])

  // Save step progress
  const saveStepProgress = async (step) => {
    try {
      await api.put('/onboarding/step', { step })
    } catch {
      // silent fail for progress saving
    }
  }

  const goNext = () => {
    if (currentStep < STEPS.length - 1) {
      const next = currentStep + 1
      setCurrentStep(next)
      saveStepProgress(next)
      setError(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      setError(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Step 2: Accept legal
  const handleLegalSubmit = async () => {
    if (!legal.agb || !legal.datenschutz || !legal.avv) {
      setError('Bitte akzeptieren Sie alle Dokumente, um fortzufahren.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.put('/onboarding/legal', { agb: true, datenschutz: true, avv: true })
      goNext()
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Speichern der rechtlichen Zustimmung.')
    } finally {
      setSaving(false)
    }
  }

  // Step 3: Create location
  const handleLocationSubmit = async () => {
    const errs = {}
    if (!locationForm.name.trim()) errs.name = 'Name ist erforderlich'
    if (!locationForm.address.trim()) errs.address = 'Adresse ist erforderlich'
    if (!locationForm.zip.trim()) errs.zip = 'PLZ ist erforderlich'
    if (!locationForm.city.trim()) errs.city = 'Stadt ist erforderlich'
    if (Object.keys(errs).length) {
      setLocationErrors(errs)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await api.post('/locations', locationForm)
      setCreatedLocation(res.data)
      goNext()
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Anlegen des Standorts.')
    } finally {
      setSaving(false)
    }
  }

  // Step 4: Bulk create spots
  const handleBulkSpots = async () => {
    if (!createdLocation?.id) {
      setError('Kein Standort vorhanden. Bitte gehen Sie zurück und erstellen Sie einen Standort.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.post('/spots/bulk', {
        location_id: createdLocation.id,
        prefix: spotForm.prefix,
        from: parseInt(spotForm.from),
        to: parseInt(spotForm.to),
        price: parseFloat(spotForm.price) || 0,
      })
      setSpotsCreated(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Erstellen der Stellplätze.')
    } finally {
      setSaving(false)
    }
  }

  // Step 4: Add duration
  const handleAddDuration = async () => {
    if (!createdLocation?.id || !newDuration.price) return
    setDurationSaving(true)
    try {
      await api.post(`/locations/${createdLocation.id}/durations`, {
        duration_type: newDuration.duration_type,
        price: parseFloat(newDuration.price),
      })
      setNewDuration({ duration_type: '30min', price: '' })
      loadDurations(createdLocation.id)
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Hinzufügen der Parkdauer.')
    } finally {
      setDurationSaving(false)
    }
  }

  const handleDeleteDuration = async (durationId) => {
    if (!createdLocation?.id) return
    try {
      await api.delete(`/locations/${createdLocation.id}/durations/${durationId}`)
      loadDurations(createdLocation.id)
    } catch {
      setError('Fehler beim Löschen der Parkdauer.')
    }
  }

  // Step 5: Save booking config & complete onboarding
  const handleCompleteOnboarding = async () => {
    setSaving(true)
    setError(null)
    try {
      if (createdLocation?.id) {
        await api.put(`/locations/${createdLocation.id}/booking-config`, bookingConfig)
      }
      await api.put('/onboarding/complete', {})
      updateOperator({ onboarding_completed: true })
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Abschließen des Onboardings.')
    } finally {
      setSaving(false)
    }
  }

  const embedCode = createdLocation
    ? `<iframe src="https://parking.visionmakegpt.work/embed/${createdLocation.id}" width="100%" height="600" frameborder="0"></iframe>`
    : ''

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode)
    setEmbedCopied(true)
    setTimeout(() => setEmbedCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <span className="text-emerald-800 font-bold text-lg">ParkSaaS</span>
            <span className="text-gray-400 text-sm ml-2">Onboarding</span>
          </div>
          <span className="text-sm text-gray-500">
            Schritt {currentStep + 1} von {STEPS.length}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex items-center py-4">
            {STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      i < currentStep
                        ? 'bg-emerald-600 text-white'
                        : i === currentStep
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {i < currentStep ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className={`text-xs font-medium hidden sm:inline ${i <= currentStep ? 'text-emerald-700' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 ${i < currentStep ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        {/* STEP 1: Welcome */}
        {currentStep === 0 && (
          <div className="text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Willkommen bei ParkSaaS, {operator?.company_name || 'Betreiber'}!
            </h1>
            <p className="text-gray-500 text-lg mb-8 max-w-lg mx-auto">
              In wenigen Schritten richten wir Ihr Konto ein und Sie können mit der Vermietung Ihrer Parkplätze starten.
            </p>

            <div className="bg-white rounded-xl border border-gray-200 p-6 text-left max-w-md mx-auto mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">Was wir gemeinsam einrichten:</h3>
              <div className="space-y-3">
                {[
                  { icon: '📋', text: 'Rechtliche Dokumente akzeptieren' },
                  { icon: '📍', text: 'Ihren ersten Standort anlegen' },
                  { icon: '🅿️', text: 'Stellplätze erstellen & Parkdauern konfigurieren' },
                  { icon: '🎨', text: 'Buchungsseite personalisieren & Embed-Code erhalten' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-sm text-gray-700">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={goNext}
              className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md text-lg"
            >
              Los geht&apos;s →
            </button>
          </div>
        )}

        {/* STEP 2: Legal */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Rechtliches</h2>
            <p className="text-gray-500 mb-6">
              Bitte lesen und akzeptieren Sie die folgenden Dokumente, um fortzufahren.
            </p>

            <div className="space-y-4">
              {/* AGB */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">Allgemeine Geschäftsbedingungen (AGB)</h3>
                    <p className="text-gray-500 text-sm mt-1">
                      Unsere AGB regeln die Nutzung der ParkSaaS-Plattform, Zahlungsabwicklung, Transaktionsgebühren sowie die Pflichten aller Beteiligten.
                    </p>
                  </div>
                  <Link to="/agb" target="_blank" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium shrink-0 ml-4">
                    Volltext lesen →
                  </Link>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={legal.agb}
                    onChange={e => setLegal(p => ({ ...p, agb: e.target.checked }))}
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Ich akzeptiere die AGB</span>
                </label>
              </div>

              {/* Datenschutz */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">Datenschutzerklärung</h3>
                    <p className="text-gray-500 text-sm mt-1">
                      Informationen zur Erhebung, Verarbeitung und Speicherung Ihrer personenbezogenen Daten gemäß DSGVO.
                    </p>
                  </div>
                  <Link to="/datenschutz" target="_blank" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium shrink-0 ml-4">
                    Volltext lesen →
                  </Link>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={legal.datenschutz}
                    onChange={e => setLegal(p => ({ ...p, datenschutz: e.target.checked }))}
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Ich akzeptiere die Datenschutzerklärung</span>
                </label>
              </div>

              {/* AVV */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">Auftragsverarbeitungsvertrag (AVV)</h3>
                    <p className="text-gray-500 text-sm mt-1">
                      Der AVV gemäß Art. 28 DSGVO regelt die Verarbeitung personenbezogener Daten Ihrer Kunden durch ParkSaaS.
                    </p>
                  </div>
                  <Link to="/avv" target="_blank" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium shrink-0 ml-4">
                    Volltext lesen →
                  </Link>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={legal.avv}
                    onChange={e => setLegal(p => ({ ...p, avv: e.target.checked }))}
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Ich akzeptiere den Auftragsverarbeitungsvertrag</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              <button onClick={goBack} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
                ← Zurück
              </button>
              <button
                onClick={handleLegalSubmit}
                disabled={saving || !legal.agb || !legal.datenschutz || !legal.avv}
                className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Speichern...' : 'Weiter →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: First Location */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Erster Standort</h2>
            <p className="text-gray-500 mb-6">
              Erstellen Sie Ihren ersten Parkplatz-Standort. Sie können später weitere hinzufügen.
            </p>

            {createdLocation ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-emerald-200 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-emerald-800">{createdLocation.name}</h3>
                    <p className="text-emerald-600 text-sm">{createdLocation.address}, {createdLocation.zip} {createdLocation.city}</p>
                  </div>
                </div>
                <p className="text-emerald-700 text-sm">Standort erfolgreich erstellt!</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="space-y-4">
                  <div>
                    <label className="label">Name des Standorts</label>
                    <input
                      className={`input-field ${locationErrors.name ? 'border-red-400' : ''}`}
                      value={locationForm.name}
                      onChange={e => { setLocationForm(p => ({ ...p, name: e.target.value })); setLocationErrors(p => ({ ...p, name: null })) }}
                      placeholder="z. B. Parkhaus Innenstadt"
                    />
                    {locationErrors.name && <p className="text-red-500 text-xs mt-1">{locationErrors.name}</p>}
                  </div>
                  <div>
                    <label className="label">Adresse</label>
                    <input
                      className={`input-field ${locationErrors.address ? 'border-red-400' : ''}`}
                      value={locationForm.address}
                      onChange={e => { setLocationForm(p => ({ ...p, address: e.target.value })); setLocationErrors(p => ({ ...p, address: null })) }}
                      placeholder="Musterstraße 1"
                    />
                    {locationErrors.address && <p className="text-red-500 text-xs mt-1">{locationErrors.address}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">PLZ</label>
                      <input
                        className={`input-field ${locationErrors.zip ? 'border-red-400' : ''}`}
                        value={locationForm.zip}
                        onChange={e => { setLocationForm(p => ({ ...p, zip: e.target.value })); setLocationErrors(p => ({ ...p, zip: null })) }}
                        placeholder="07545"
                        maxLength={5}
                      />
                      {locationErrors.zip && <p className="text-red-500 text-xs mt-1">{locationErrors.zip}</p>}
                    </div>
                    <div>
                      <label className="label">Stadt</label>
                      <input
                        className={`input-field ${locationErrors.city ? 'border-red-400' : ''}`}
                        value={locationForm.city}
                        onChange={e => { setLocationForm(p => ({ ...p, city: e.target.value })); setLocationErrors(p => ({ ...p, city: null })) }}
                        placeholder="Gera"
                      />
                      {locationErrors.city && <p className="text-red-500 text-xs mt-1">{locationErrors.city}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-8">
              <button onClick={goBack} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
                ← Zurück
              </button>
              {createdLocation ? (
                <button
                  onClick={goNext}
                  className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition-all"
                >
                  Weiter →
                </button>
              ) : (
                <button
                  onClick={handleLocationSubmit}
                  disabled={saving}
                  className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  {saving ? 'Erstellen...' : 'Standort anlegen'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Spots & Durations */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Stellplätze & Parkdauern</h2>
            <p className="text-gray-500 mb-6">
              Erstellen Sie Stellplätze und konfigurieren Sie Parkdauern für{' '}
              <strong>{createdLocation?.name || 'Ihren Standort'}</strong>.
            </p>

            {/* Bulk spot creation */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Stellplätze erstellen</h3>
              {spotsCreated ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-emerald-700 text-sm font-medium">
                    Stellplätze {spotForm.prefix}{spotForm.from} bis {spotForm.prefix}{spotForm.to} erfolgreich erstellt!
                  </span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div>
                      <label className="label">Prefix</label>
                      <input
                        className="input-field"
                        value={spotForm.prefix}
                        onChange={e => setSpotForm(p => ({ ...p, prefix: e.target.value }))}
                        placeholder="P"
                      />
                    </div>
                    <div>
                      <label className="label">Von</label>
                      <input
                        type="number"
                        className="input-field"
                        value={spotForm.from}
                        onChange={e => setSpotForm(p => ({ ...p, from: e.target.value }))}
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="label">Bis</label>
                      <input
                        type="number"
                        className="input-field"
                        value={spotForm.to}
                        onChange={e => setSpotForm(p => ({ ...p, to: e.target.value }))}
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="label">Preis (EUR)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field"
                        value={spotForm.price}
                        onChange={e => setSpotForm(p => ({ ...p, price: e.target.value }))}
                        placeholder="50.00"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    Erstellt Stellplätze {spotForm.prefix}{spotForm.from} bis {spotForm.prefix}{spotForm.to} zum Preis von {spotForm.price} EUR pro Stellplatz.
                  </p>
                  <button
                    onClick={handleBulkSpots}
                    disabled={saving}
                    className="btn-primary text-sm"
                  >
                    {saving ? 'Erstellen...' : 'Stellplätze erstellen'}
                  </button>
                </>
              )}
            </div>

            {/* Durations */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Parkdauern & Preise</h3>

              {durations.length > 0 && (
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
                          <p className="text-sm font-medium text-gray-900">{DURATION_TYPES[d.duration_type] || d.duration_type}</p>
                          <p className="text-xs text-gray-500">{formatPrice(d.price)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteDuration(d.id)}
                        className="text-red-400 hover:text-red-600 p-1"
                        title="Löschen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-3">
                <div className="flex-1">
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
                <div className="flex-1">
                  <label className="label">Preis (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field"
                    value={newDuration.price}
                    onChange={e => setNewDuration(p => ({ ...p, price: e.target.value }))}
                    placeholder="z. B. 3.50"
                  />
                </div>
                <button
                  onClick={handleAddDuration}
                  disabled={durationSaving || !newDuration.price}
                  className="btn-primary text-sm shrink-0"
                >
                  {durationSaving ? '...' : '+ Hinzufügen'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              <button onClick={goBack} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
                ← Zurück
              </button>
              <button
                onClick={goNext}
                className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition-all"
              >
                Weiter →
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Booking Page */}
        {currentStep === 4 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Buchungsseite</h2>
            <p className="text-gray-500 mb-6">
              Personalisieren Sie Ihre Buchungsseite und erhalten Sie den Embed-Code.
            </p>

            {/* Public URL */}
            {operator?.slug && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-emerald-700 font-medium mb-1">Ihre öffentliche Buchungsseite:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-emerald-200 rounded-lg px-3 py-2 text-sm font-mono text-emerald-800 truncate">
                    parking.visionmakegpt.work/park/{operator.slug}
                  </code>
                  <a
                    href={`/park/${operator.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary text-sm shrink-0"
                  >
                    Öffnen
                  </a>
                </div>
              </div>
            )}

            {/* Color Configuration */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Farben anpassen</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
            </div>

            {/* Text Configuration */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Texte anpassen</h3>
              <div className="space-y-4">
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
              </div>
            </div>

            {/* Mini Preview */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Vorschau</h3>
              <div
                className="rounded-xl border-2 border-gray-200 p-6 transition-all"
                style={{ backgroundColor: bookingConfig.background_color, color: bookingConfig.text_color }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: bookingConfig.primary_color }}>
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </div>
                  <span className="font-bold">{operator?.company_name || 'Ihr Unternehmen'}</span>
                </div>
                <p className="text-sm mb-4">{bookingConfig.welcome_text}</p>
                <div className="flex gap-2 mb-4">
                  {['P1', 'P2', 'P3', 'P4'].map(s => (
                    <div
                      key={s}
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: bookingConfig.accent_color }}
                    >
                      {s}
                    </div>
                  ))}
                </div>
                <button
                  className="px-6 py-2 rounded-lg text-white font-semibold text-sm"
                  style={{ backgroundColor: bookingConfig.primary_color }}
                >
                  {bookingConfig.button_text}
                </button>
              </div>
            </div>

            {/* Embed Code */}
            {createdLocation && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">Embed-Code (iFrame)</h3>
                <p className="text-gray-500 text-sm mb-3">
                  Kopieren Sie diesen Code und fügen Sie ihn in Ihre Website ein:
                </p>
                <div className="relative">
                  <pre className="bg-gray-900 text-emerald-400 rounded-lg p-4 text-xs overflow-x-auto font-mono">
                    {embedCode}
                  </pre>
                  <button
                    onClick={copyEmbed}
                    className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs transition-colors"
                  >
                    {embedCopied ? '✓ Kopiert!' : 'Kopieren'}
                  </button>
                </div>
              </div>
            )}

            {/* Custom CSS */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Eigenes CSS (optional)</h3>
              <textarea
                className="input-field font-mono text-xs"
                rows={4}
                value={bookingConfig.custom_css}
                onChange={e => setBookingConfig(p => ({ ...p, custom_css: e.target.value }))}
                placeholder="/* Eigenes CSS für die Buchungsseite */"
              />
            </div>

            <div className="flex items-center justify-between mt-8">
              <button onClick={goBack} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
                ← Zurück
              </button>
              <button
                onClick={handleCompleteOnboarding}
                disabled={saving}
                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50"
              >
                {saving ? 'Abschließen...' : 'Onboarding abschließen ✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
