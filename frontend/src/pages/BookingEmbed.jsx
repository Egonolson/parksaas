import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'

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

const EMPTY_FORM = {
  customer_type: 'private',
  company_name: '',
  tax_id: '',
  name: '',
  email: '',
  phone: '',
  license_plate: '',
  street: '',
  zip: '',
  city: '',
}

export default function BookingEmbed() {
  const { locationId } = useParams()
  const [searchParams] = useSearchParams()
  const [config, setConfig] = useState(null)
  const [location, setLocation] = useState(null)
  const [spots, setSpots] = useState([])
  const [durations, setDurations] = useState([])
  const [selectedSpot, setSelectedSpot] = useState(null)
  const [selectedDuration, setSelectedDuration] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('select') // 'select' | 'form' | 'success'

  // Override colors from URL params
  const paramPrimary = searchParams.get('primaryColor')
  const paramAccent = searchParams.get('accentColor')
  const paramBg = searchParams.get('backgroundColor')
  const paramText = searchParams.get('textColor')
  const hideHeader = searchParams.get('hideHeader') === 'true'

  const colors = {
    primary: paramPrimary || config?.primary_color || '#059669',
    accent: paramAccent || config?.accent_color || '#10b981',
    background: paramBg || config?.background_color || '#f9fafb',
    text: paramText || config?.text_color || '#111827',
  }

  const formatPrice = (amount) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`/api/v1/embed/${locationId}`)
        setConfig(res.data.config || {})
        setLocation(res.data.location || null)
        setSpots(res.data.spots || [])
        setDurations(res.data.durations || [])
      } catch {
        setError('Buchungsseite konnte nicht geladen werden.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [locationId])

  // Inject custom CSS
  useEffect(() => {
    if (config?.custom_css) {
      const style = document.createElement('style')
      style.textContent = config.custom_css
      style.setAttribute('data-embed-css', 'true')
      document.head.appendChild(style)
      return () => {
        document.head.removeChild(style)
      }
    }
  }, [config?.custom_css])

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name erforderlich'
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Gültige E-Mail erforderlich'
    if (!form.phone.trim()) errs.phone = 'Telefon erforderlich'
    if (!form.license_plate.trim()) errs.license_plate = 'Kennzeichen erforderlich'
    if (!form.street.trim()) errs.street = 'Adresse erforderlich'
    if (!form.zip.trim()) errs.zip = 'PLZ erforderlich'
    if (!form.city.trim()) errs.city = 'Stadt erforderlich'
    if (form.customer_type === 'business' && !form.company_name.trim()) errs.company_name = 'Firmenname erforderlich'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setFormErrors(errs); return }

    setSubmitting(true)
    setError(null)
    try {
      const bookingData = {
        spot_id: selectedSpot.id,
        duration_type: selectedDuration?.duration_type || null,
        customer_type: form.customer_type,
        name: form.name,
        email: form.email,
        phone: form.phone,
        license_plate: form.license_plate,
        street: form.street,
        zip: form.zip,
        city: form.city,
      }
      if (form.customer_type === 'business') {
        bookingData.company_name = form.company_name
        bookingData.tax_id = form.tax_id
      }
      const res = await axios.post(`/api/v1/embed/${locationId}/book`, bookingData)
      if (res.data.checkout_url) {
        // Notify parent window
        window.parent.postMessage({ type: 'parksaas:redirect', url: res.data.checkout_url }, '*')
        window.location.href = res.data.checkout_url
      } else {
        setStep('success')
        window.parent.postMessage({ type: 'parksaas:booking_complete', spotId: selectedSpot.id, spotNumber: selectedSpot.number }, '*')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler bei der Buchung.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12" style={{ backgroundColor: colors.background }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: colors.text }}>Lade...</p>
        </div>
      </div>
    )
  }

  if (error && !location) {
    return (
      <div className="flex items-center justify-center p-12" style={{ backgroundColor: colors.background }}>
        <div className="text-center">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="flex items-center justify-center p-12" style={{ backgroundColor: colors.background }}>
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: colors.primary + '20' }}>
            <svg className="w-7 h-7" fill="none" stroke={colors.primary} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: colors.text }}>Buchung eingegangen!</h2>
          <p className="text-sm text-gray-500">
            Spot <strong>{selectedSpot?.number}</strong> wurde gebucht. Bestätigung an <strong>{form.email}</strong>.
          </p>
        </div>
      </div>
    )
  }

  const availableSpots = spots.filter(s => s.status === 'available' || s.status === 'frei')

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.background, color: colors.text }}>
      {/* Header (unless hidden) */}
      {!hideHeader && (
        <div className="px-6 py-4" style={{ backgroundColor: colors.primary }}>
          <div className="max-w-3xl mx-auto">
            <h1 className="text-lg font-bold text-white">{config?.welcome_text || location?.name || 'Stellplatz buchen'}</h1>
            {location && (
              <p className="text-white/70 text-sm">{location.address}, {location.zip} {location.city}</p>
            )}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-6 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-6">
            {/* Spot Grid */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold mb-3" style={{ color: colors.text }}>Stellplatz auswählen</h2>
              {availableSpots.length === 0 ? (
                <p className="text-gray-400 text-sm py-4 text-center">Keine Stellplätze verfügbar.</p>
              ) : (
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                  {spots.map(spot => {
                    const isAvailable = spot.status === 'available' || spot.status === 'frei'
                    const isSelected = selectedSpot?.id === spot.id
                    return (
                      <button
                        key={spot.id}
                        disabled={!isAvailable}
                        onClick={() => { setSelectedSpot(spot); setSelectedDuration(null) }}
                        className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                          isSelected
                            ? 'ring-2 ring-offset-1 text-white'
                            : isAvailable
                            ? 'hover:opacity-80 text-white cursor-pointer'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        style={isAvailable ? {
                          backgroundColor: isSelected ? colors.primary : colors.accent,
                          ringColor: colors.primary,
                        } : undefined}
                      >
                        {spot.number}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Duration selection */}
            {selectedSpot && durations.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold mb-3" style={{ color: colors.text }}>Parkdauer wählen</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {durations.map(d => (
                    <button
                      key={d.id}
                      onClick={() => { setSelectedDuration(d); setStep('form') }}
                      className="flex items-center justify-between p-3 rounded-lg border-2 border-gray-200 hover:border-emerald-400 transition-all text-left"
                    >
                      <div>
                        <p className="font-medium text-sm">{DURATION_TYPES[d.duration_type] || d.duration_type}</p>
                        <p className="text-sm font-semibold" style={{ color: colors.primary }}>{formatPrice(d.price)}</p>
                      </div>
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedSpot && durations.length === 0 && (
              <div className="text-center py-4">
                <button
                  onClick={() => { setSelectedDuration(null); setStep('form') }}
                  className="text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                  style={{ backgroundColor: colors.primary }}
                >
                  {config?.button_text || 'Jetzt buchen'} →
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'form' && selectedSpot && (
          <div>
            {/* Selection summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Spot {selectedSpot.number}</span>
                {selectedDuration && (
                  <span className="text-sm text-gray-500 ml-2">
                    — {DURATION_TYPES[selectedDuration.duration_type] || selectedDuration.duration_type} ({formatPrice(selectedDuration.price)})
                  </span>
                )}
              </div>
              <button
                onClick={() => { setStep('select'); setSelectedSpot(null); setSelectedDuration(null) }}
                className="text-xs font-medium" style={{ color: colors.primary }}
              >
                Ändern
              </button>
            </div>

            {/* Booking Form */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold mb-4" style={{ color: colors.text }}>Ihre Daten</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Customer type */}
                <div className="flex gap-3">
                  {['private', 'business'].map(t => (
                    <label key={t} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer text-sm transition-all ${form.customer_type === t ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}>
                      <input
                        type="radio"
                        name="customer_type"
                        value={t}
                        checked={form.customer_type === t}
                        onChange={e => setForm(p => ({ ...p, customer_type: e.target.value }))}
                        className="text-emerald-600"
                      />
                      {t === 'private' ? 'Privat' : 'Geschäftlich'}
                    </label>
                  ))}
                </div>

                {form.customer_type === 'business' && (
                  <div className="grid grid-cols-2 gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div>
                      <label className="label">Firmenname</label>
                      <input className={`input-field ${formErrors.company_name ? 'border-red-400' : ''}`} value={form.company_name} onChange={e => { setForm(p => ({ ...p, company_name: e.target.value })); setFormErrors(p => ({ ...p, company_name: null })) }} placeholder="Muster GmbH" />
                      {formErrors.company_name && <p className="text-red-500 text-xs mt-1">{formErrors.company_name}</p>}
                    </div>
                    <div>
                      <label className="label">USt-IdNr.</label>
                      <input className="input-field" value={form.tax_id} onChange={e => setForm(p => ({ ...p, tax_id: e.target.value }))} placeholder="DE123456789" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="label">Name</label>
                  <input className={`input-field ${formErrors.name ? 'border-red-400' : ''}`} value={form.name} onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setFormErrors(p => ({ ...p, name: null })) }} placeholder="Max Mustermann" />
                  {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">E-Mail</label>
                    <input type="email" className={`input-field ${formErrors.email ? 'border-red-400' : ''}`} value={form.email} onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setFormErrors(p => ({ ...p, email: null })) }} placeholder="max@example.de" />
                    {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                  </div>
                  <div>
                    <label className="label">Telefon</label>
                    <input className={`input-field ${formErrors.phone ? 'border-red-400' : ''}`} value={form.phone} onChange={e => { setForm(p => ({ ...p, phone: e.target.value })); setFormErrors(p => ({ ...p, phone: null })) }} placeholder="+49 170 ..." />
                    {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
                  </div>
                </div>

                <div>
                  <label className="label">Kennzeichen</label>
                  <input className={`input-field font-mono ${formErrors.license_plate ? 'border-red-400' : ''}`} value={form.license_plate} onChange={e => { setForm(p => ({ ...p, license_plate: e.target.value.toUpperCase() })); setFormErrors(p => ({ ...p, license_plate: null })) }} placeholder="HH-XX 1234" />
                  {formErrors.license_plate && <p className="text-red-500 text-xs mt-1">{formErrors.license_plate}</p>}
                </div>

                <div>
                  <label className="label">Straße</label>
                  <input className={`input-field ${formErrors.street ? 'border-red-400' : ''}`} value={form.street} onChange={e => { setForm(p => ({ ...p, street: e.target.value })); setFormErrors(p => ({ ...p, street: null })) }} placeholder="Musterstraße 1" />
                  {formErrors.street && <p className="text-red-500 text-xs mt-1">{formErrors.street}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">PLZ</label>
                    <input className={`input-field ${formErrors.zip ? 'border-red-400' : ''}`} value={form.zip} onChange={e => { setForm(p => ({ ...p, zip: e.target.value })); setFormErrors(p => ({ ...p, zip: null })) }} placeholder="20095" maxLength={5} />
                    {formErrors.zip && <p className="text-red-500 text-xs mt-1">{formErrors.zip}</p>}
                  </div>
                  <div>
                    <label className="label">Stadt</label>
                    <input className={`input-field ${formErrors.city ? 'border-red-400' : ''}`} value={form.city} onChange={e => { setForm(p => ({ ...p, city: e.target.value })); setFormErrors(p => ({ ...p, city: null })) }} placeholder="Hamburg" />
                    {formErrors.city && <p className="text-red-500 text-xs mt-1">{formErrors.city}</p>}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 border border-gray-100">
                  Mit dem Absenden stimmen Sie den Nutzungsbedingungen zu.
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-60"
                  style={{ backgroundColor: colors.primary }}
                >
                  {submitting ? 'Weiterleitung...' : (config?.button_text || 'Jetzt buchen')}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
