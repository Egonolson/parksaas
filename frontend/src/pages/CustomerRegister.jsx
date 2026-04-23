import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'

export default function CustomerRegister() {
  const [searchParams] = useSearchParams()
  const tenantSlug = searchParams.get('tenant') || ''
  const { customerRegister, loading, error: authError } = useAuth()
  const navigate = useNavigate()
  const [agbAccepted, setAgbAccepted] = useState(false)
  const [datenschutzAccepted, setDatenschutzAccepted] = useState(false)
  const [tenants, setTenants] = useState([])
  const [tenantLoading, setTenantLoading] = useState(false)
  const [selectedTenantSlug, setSelectedTenantSlug] = useState(tenantSlug)

  const [form, setForm] = useState({
    customer_type: 'private',
    company_name: '',
    tax_id: '',
    name: '',
    email: '',
    phone: '',
    street: '',
    zip: '',
    city: '',
    password: '',
    password_confirm: '',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const loadTenants = async () => {
      if (tenantSlug) return
      setTenantLoading(true)
      try {
        const res = await api.get('/auth/customer/tenants')
        const tenantOptions = res.data?.tenants || []
        setTenants(tenantOptions)
        if (tenantOptions.length === 1) {
          setSelectedTenantSlug(tenantOptions[0].slug)
        }
      } catch {
        setTenants([])
      } finally {
        setTenantLoading(false)
      }
    }
    loadTenants()
  }, [tenantSlug])

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name ist erforderlich'
    if (!form.email) errs.email = 'E-Mail ist erforderlich'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Ungültige E-Mail'
    if (!form.phone.trim()) errs.phone = 'Telefon ist erforderlich'
    if (!form.street.trim()) errs.street = 'Straße ist erforderlich'
    if (!form.zip.trim()) errs.zip = 'PLZ ist erforderlich'
    if (!form.city.trim()) errs.city = 'Ort ist erforderlich'
    if (!form.password) errs.password = 'Passwort ist erforderlich'
    else if (form.password.length < 8) errs.password = 'Mindestens 8 Zeichen'
    if (form.password !== form.password_confirm) errs.password_confirm = 'Passwörter stimmen nicht überein'
    if (form.customer_type === 'business') {
      if (!form.company_name.trim()) errs.company_name = 'Firmenname ist erforderlich'
    }
    if (!agbAccepted) errs.agb = 'Bitte akzeptieren Sie die AGB'
    if (!datenschutzAccepted) errs.datenschutz = 'Bitte akzeptieren Sie die Datenschutzerklärung'
    if (!tenantSlug && tenants.length > 1 && !selectedTenantSlug) errs.tenant_slug = 'Bitte wählen Sie einen Betreiber'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    const payload = {
      customer_type: form.customer_type,
      name: form.name,
      email: form.email,
      phone: form.phone,
      street: form.street,
      zip: form.zip,
      city: form.city,
      password: form.password,
      legal_agb_accepted: agbAccepted,
      legal_datenschutz_accepted: datenschutzAccepted,
    }
    if (form.customer_type === 'business') {
      payload.company_name = form.company_name
      payload.tax_id = form.tax_id
    }
    const resolvedTenantSlug = tenantSlug || selectedTenantSlug
    if (resolvedTenantSlug) {
      payload.tenant_slug = resolvedTenantSlug
    }
    const result = await customerRegister(payload)
    if (result.success) {
      navigate('/kunde/dashboard')
    } else {
      const message = result.error || 'Registrierung fehlgeschlagen'
      if (message.includes('TenantSelectionRequired') || message.includes('Betreiber')) {
        setErrors({ tenant_slug: 'Bitte wählen Sie einen Betreiber', general: 'Bitte wählen Sie einen Betreiber aus.' })
      } else {
        setErrors({ general: message })
      }
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  const inputClass = (field) =>
    `input-field ${errors[field] ? 'border-red-400 focus:ring-red-400' : ''}`

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <span className="text-emerald-800 font-bold text-2xl">ParkSaaS</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-1">Konto erstellen</h1>
          <p className="text-gray-500 text-sm">Erstellen Sie Ihr Kundenkonto bei ParkSaaS</p>
        </div>

        <div className="card p-8">
          {(errors.general || authError) && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {errors.general || authError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!tenantSlug && (
              <div>
                <label className="label">Betreiber</label>
                <select
                  value={selectedTenantSlug}
                  onChange={(e) => {
                    setSelectedTenantSlug(e.target.value)
                    if (errors.tenant_slug) setErrors(prev => ({ ...prev, tenant_slug: null }))
                  }}
                  className={inputClass('tenant_slug')}
                  disabled={tenantLoading}
                >
                  <option value="">Bitte Betreiber wählen</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.slug}>
                      {tenant.name} {tenant.available_spots > 0 ? `(${tenant.available_spots} freie Plätze)` : '(derzeit keine freien Plätze)'}
                    </option>
                  ))}
                </select>
                {tenantLoading && <p className="text-gray-500 text-xs mt-1">Betreiber werden geladen ...</p>}
                {errors.tenant_slug && <p className="text-red-500 text-xs mt-1">{errors.tenant_slug}</p>}
              </div>
            )}

            {/* Customer type */}
            <div>
              <label className="label mb-2">Kundentyp</label>
              <div className="flex gap-4">
                <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all ${form.customer_type === 'private' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  <input
                    type="radio"
                    name="customer_type"
                    value="private"
                    checked={form.customer_type === 'private'}
                    onChange={handleChange}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium">Privat</span>
                </label>
                <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-all ${form.customer_type === 'business' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  <input
                    type="radio"
                    name="customer_type"
                    value="business"
                    checked={form.customer_type === 'business'}
                    onChange={handleChange}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium">Geschäftlich</span>
                </label>
              </div>
            </div>

            {/* Business fields */}
            {form.customer_type === 'business' && (
              <div className="space-y-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div>
                  <label className="label">Firmenname</label>
                  <input
                    name="company_name"
                    value={form.company_name}
                    onChange={handleChange}
                    className={inputClass('company_name')}
                    placeholder="Muster GmbH"
                  />
                  {errors.company_name && <p className="text-red-500 text-xs mt-1">{errors.company_name}</p>}
                </div>
                <div>
                  <label className="label">Steuernummer / USt-IdNr.</label>
                  <input
                    name="tax_id"
                    value={form.tax_id}
                    onChange={handleChange}
                    className={inputClass('tax_id')}
                    placeholder="DE123456789"
                  />
                  {errors.tax_id && <p className="text-red-500 text-xs mt-1">{errors.tax_id}</p>}
                </div>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="label">Vor- und Nachname</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                className={inputClass('name')}
                placeholder="Max Mustermann"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">E-Mail</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className={inputClass('email')}
                  placeholder="max@example.de"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="label">Telefon</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className={inputClass('phone')}
                  placeholder="+49 170 ..."
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="label">Straße</label>
              <input
                name="street"
                value={form.street}
                onChange={handleChange}
                className={inputClass('street')}
                placeholder="Musterstraße 1"
              />
              {errors.street && <p className="text-red-500 text-xs mt-1">{errors.street}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">PLZ</label>
                <input
                  name="zip"
                  value={form.zip}
                  onChange={handleChange}
                  className={inputClass('zip')}
                  placeholder="20095"
                  maxLength={5}
                />
                {errors.zip && <p className="text-red-500 text-xs mt-1">{errors.zip}</p>}
              </div>
              <div>
                <label className="label">Ort</label>
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  className={inputClass('city')}
                  placeholder="Hamburg"
                />
                {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
              </div>
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Passwort</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className={inputClass('password')}
                  placeholder="Min. 8 Zeichen"
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>
              <div>
                <label className="label">Passwort bestätigen</label>
                <input
                  type="password"
                  name="password_confirm"
                  value={form.password_confirm}
                  onChange={handleChange}
                  className={inputClass('password_confirm')}
                  placeholder="Passwort wiederholen"
                />
                {errors.password_confirm && <p className="text-red-500 text-xs mt-1">{errors.password_confirm}</p>}
              </div>
            </div>

            {/* Legal checkboxes */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agbAccepted}
                  onChange={e => { setAgbAccepted(e.target.checked); if (errors.agb) setErrors(p => ({ ...p, agb: null })) }}
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 mt-0.5"
                />
                <span className="text-xs text-gray-600">
                  Ich akzeptiere die{' '}
                  <Link to="/agb" target="_blank" className="text-emerald-600 hover:underline font-medium">AGB</Link>
                </span>
              </label>
              {errors.agb && <p className="text-red-500 text-xs ml-6">{errors.agb}</p>}

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={datenschutzAccepted}
                  onChange={e => { setDatenschutzAccepted(e.target.checked); if (errors.datenschutz) setErrors(p => ({ ...p, datenschutz: null })) }}
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 mt-0.5"
                />
                <span className="text-xs text-gray-600">
                  Ich habe die{' '}
                  <Link to="/datenschutz" target="_blank" className="text-emerald-600 hover:underline font-medium">Datenschutzerklärung</Link> gelesen
                </span>
              </label>
              {errors.datenschutz && <p className="text-red-500 text-xs ml-6">{errors.datenschutz}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-semibold hover:bg-emerald-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Registrieren...
                </span>
              ) : 'Registrieren'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Bereits ein Konto?{' '}
          <Link to="/kunde/login" className="text-emerald-600 font-medium hover:underline">
            Jetzt anmelden
          </Link>
        </p>
      </div>
    </div>
  )
}
