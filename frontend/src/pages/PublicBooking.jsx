import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import SpotGrid from '../components/SpotGrid'

const MOCK_OPERATOR = {
  company_name: 'Parkhaus Mitte GmbH',
  slug: 'parkhaus-mitte',
}

const MOCK_SPOTS = [
  { id: 1, number: 'A-01', status: 'occupied', price: 120 },
  { id: 2, number: 'A-02', status: 'free', price: 120 },
  { id: 3, number: 'A-03', status: 'free', price: 120 },
  { id: 4, number: 'A-04', status: 'reserved', price: 95 },
  { id: 5, number: 'B-01', status: 'free', price: 100 },
  { id: 6, number: 'B-02', status: 'occupied', price: 100 },
  { id: 7, number: 'B-03', status: 'free', price: 80 },
  { id: 8, number: 'B-04', status: 'occupied', price: 80 },
  { id: 9, number: 'B-05', status: 'free', price: 80 },
  { id: 10, number: 'C-01', status: 'free', price: 110 },
  { id: 11, number: 'C-02', status: 'reserved', price: 110 },
  { id: 12, number: 'C-03', status: 'occupied', price: 110 },
]

const MOCK_LOCATION = {
  id: 1,
  name: 'Hauptgebaeude',
  address: 'Musterstrasse 1',
  zip: '20095',
  city: 'Hamburg',
}

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  license_plate: '',
  street: '',
  zip: '',
  city: '',
}

export default function PublicBooking() {
  const { slug } = useParams()
  const [operator, setOperator] = useState(null)
  const [location, setLocation] = useState(null)
  const [spots, setSpots] = useState([])
  const [selectedSpot, setSelectedSpot] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('select') // 'select' | 'form' | 'success'

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`/api/public/${slug}`)
        setOperator(res.data.operator)
        setLocation(res.data.location)
        setSpots(res.data.spots || [])
      } catch {
        setOperator(MOCK_OPERATOR)
        setLocation(MOCK_LOCATION)
        setSpots(MOCK_SPOTS)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [slug])

  const handleSpotSelect = (spot) => {
    setSelectedSpot(spot)
    setStep('form')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name erforderlich'
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Gueltige E-Mail erforderlich'
    if (!form.phone.trim()) errs.phone = 'Telefon erforderlich'
    if (!form.license_plate.trim()) errs.license_plate = 'Kennzeichen erforderlich'
    if (!form.street.trim()) errs.street = 'Adresse erforderlich'
    if (!form.zip.trim()) errs.zip = 'PLZ erforderlich'
    if (!form.city.trim()) errs.city = 'Stadt erforderlich'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setFormErrors(errs); return }

    setSubmitting(true)
    setError(null)
    try {
      const res = await axios.post(`/api/public/${slug}/book`, {
        spot_id: selectedSpot.id,
        ...form,
      })
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url
      } else {
        setStep('success')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler bei der Buchung. Bitte versuchen Sie es erneut.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Lade...</p>
        </div>
      </div>
    )
  }

  if (!operator) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Seite nicht gefunden</h1>
          <p className="text-gray-500">Dieser Parkplatz-Betreiber existiert nicht.</p>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Buchung eingegangen!</h2>
          <p className="text-gray-500 mb-2">
            Ihre Buchung fuer Spot <strong>{selectedSpot?.number}</strong> wurde eingegangen.
          </p>
          <p className="text-gray-500 text-sm">
            Sie erhalten in Kuerze eine Bestaetigung an <strong>{form.email}</strong>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-700 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold">{operator.company_name}</h1>
              <p className="text-blue-300 text-sm">Stellplatz buchen</p>
            </div>
          </div>
          {location && (
            <div className="flex items-center gap-2 text-blue-200 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {location.address}, {location.zip} {location.city}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-8">
          <div className={`flex items-center gap-2 text-sm font-medium ${step === 'select' ? 'text-blue-800' : 'text-gray-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'select' ? 'bg-blue-800 text-white' : 'bg-green-500 text-white'}`}>
              {step === 'form' ? '✓' : '1'}
            </span>
            Spot auswaehlen
          </div>
          <div className="flex-1 h-px bg-gray-200" />
          <div className={`flex items-center gap-2 text-sm font-medium ${step === 'form' ? 'text-blue-800' : 'text-gray-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'form' ? 'bg-blue-800 text-white' : 'bg-gray-200 text-gray-500'}`}>
              2
            </span>
            Ihre Daten
          </div>
          <div className="flex-1 h-px bg-gray-200" />
          <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
            <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs">3</span>
            Zahlung
          </div>
        </div>

        {step === 'select' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Freien Stellplatz auswaehlen</h2>
            <p className="text-gray-500 text-sm mb-6">Klicken Sie auf einen gruen markierten Stellplatz, um ihn zu buchen.</p>
            <SpotGrid spots={spots} onSpotClick={handleSpotSelect} interactive={true} />
          </div>
        )}

        {step === 'form' && selectedSpot && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Selected spot info */}
            <div className="md:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-4">
                <h3 className="font-semibold text-gray-900 mb-3">Ihre Auswahl</h3>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="text-2xl font-bold text-green-800 mb-1">{selectedSpot.number}</div>
                  <div className="text-green-700 text-sm font-medium">{location?.name}</div>
                  <div className="text-green-600 text-xs mt-1">{location?.address}</div>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">Monatlich</span>
                  <span className="font-semibold text-gray-900">
                    {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(selectedSpot.price || 0)}
                  </span>
                </div>
                <button
                  onClick={() => { setSelectedSpot(null); setStep('select') }}
                  className="w-full text-center text-xs text-blue-700 hover:underline mt-2"
                >
                  Anderen Spot auswaehlen
                </button>
              </div>
            </div>

            {/* Booking form */}
            <div className="md:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-5">Ihre Daten</h2>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="label">Vor- und Nachname</label>
                    <input
                      className={`input-field ${formErrors.name ? 'border-red-400' : ''}`}
                      value={form.name}
                      onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setFormErrors(p => ({ ...p, name: null })) }}
                      placeholder="Max Mustermann"
                    />
                    {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">E-Mail</label>
                      <input
                        type="email"
                        className={`input-field ${formErrors.email ? 'border-red-400' : ''}`}
                        value={form.email}
                        onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setFormErrors(p => ({ ...p, email: null })) }}
                        placeholder="max@example.de"
                      />
                      {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                    </div>
                    <div>
                      <label className="label">Telefon</label>
                      <input
                        className={`input-field ${formErrors.phone ? 'border-red-400' : ''}`}
                        value={form.phone}
                        onChange={e => { setForm(p => ({ ...p, phone: e.target.value })); setFormErrors(p => ({ ...p, phone: null })) }}
                        placeholder="+49 170 ..."
                      />
                      {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="label">Kennzeichen</label>
                    <input
                      className={`input-field font-mono ${formErrors.license_plate ? 'border-red-400' : ''}`}
                      value={form.license_plate}
                      onChange={e => { setForm(p => ({ ...p, license_plate: e.target.value.toUpperCase() })); setFormErrors(p => ({ ...p, license_plate: null })) }}
                      placeholder="HH-XX 1234"
                    />
                    {formErrors.license_plate && <p className="text-red-500 text-xs mt-1">{formErrors.license_plate}</p>}
                  </div>
                  <div className="border-t border-gray-100 pt-4">
                    <label className="label">Strassenadresse</label>
                    <input
                      className={`input-field ${formErrors.street ? 'border-red-400' : ''}`}
                      value={form.street}
                      onChange={e => { setForm(p => ({ ...p, street: e.target.value })); setFormErrors(p => ({ ...p, street: null })) }}
                      placeholder="Musterstrasse 1"
                    />
                    {formErrors.street && <p className="text-red-500 text-xs mt-1">{formErrors.street}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">PLZ</label>
                      <input
                        className={`input-field ${formErrors.zip ? 'border-red-400' : ''}`}
                        value={form.zip}
                        onChange={e => { setForm(p => ({ ...p, zip: e.target.value })); setFormErrors(p => ({ ...p, zip: null })) }}
                        placeholder="20095"
                        maxLength={5}
                      />
                      {formErrors.zip && <p className="text-red-500 text-xs mt-1">{formErrors.zip}</p>}
                    </div>
                    <div>
                      <label className="label">Stadt</label>
                      <input
                        className={`input-field ${formErrors.city ? 'border-red-400' : ''}`}
                        value={form.city}
                        onChange={e => { setForm(p => ({ ...p, city: e.target.value })); setFormErrors(p => ({ ...p, city: null })) }}
                        placeholder="Hamburg"
                      />
                      {formErrors.city && <p className="text-red-500 text-xs mt-1">{formErrors.city}</p>}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 border border-gray-100">
                    Mit dem Absenden stimmen Sie den Nutzungsbedingungen zu. Sie werden nach dem Absenden zu unserem
                    Zahlungsanbieter Mollie weitergeleitet.
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-800 text-white py-3 rounded-xl font-semibold hover:bg-blue-900 transition-colors disabled:opacity-60"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Weiterleitung...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Jetzt kostenpflichtig buchen
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </span>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 py-6 mt-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-xs text-gray-400">
          Powered by <strong className="text-gray-600">ParkSaaS</strong> &bull; Sichere Zahlungen via Mollie
        </div>
      </div>
    </div>
  )
}
