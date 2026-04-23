import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useAuth } from '../hooks/useAuth'

export default function CustomerProfile() {
  const { updateCustomer } = useAuth()
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
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/customer/profile')
        const data = res.data.customer || res.data
        setForm({
          customer_type: data.customer_type || 'private',
          company_name: data.company_name || '',
          tax_id: data.tax_id || '',
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          street: data.street || '',
          zip: data.zip || '',
          city: data.city || '',
        })
      } catch (err) {
        console.error('Fehler beim Laden des Profils:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name ist erforderlich'
    if (!form.phone.trim()) errs.phone = 'Telefon ist erforderlich'
    if (!form.street.trim()) errs.street = 'Straße ist erforderlich'
    if (!form.zip.trim()) errs.zip = 'PLZ ist erforderlich'
    if (!form.city.trim()) errs.city = 'Ort ist erforderlich'
    if (form.customer_type === 'business' && !form.company_name.trim()) {
      errs.company_name = 'Firmenname ist erforderlich'
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSuccess(false)
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setSaving(true)
    try {
      const payload = {
        customer_type: form.customer_type,
        name: form.name,
        phone: form.phone,
        street: form.street,
        zip: form.zip,
        city: form.city,
      }
      if (form.customer_type === 'business') {
        payload.company_name = form.company_name
        payload.tax_id = form.tax_id
      }
      await api.put('/customer/profile', payload)
      updateCustomer(payload)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setErrors({ general: err.response?.data?.message || 'Fehler beim Speichern' })
    } finally {
      setSaving(false)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Profil wird geladen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meine Daten</h1>
        <p className="text-gray-500 text-sm mt-1">Bearbeiten Sie Ihre persönlichen Daten</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {errors.general && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            {errors.general}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
            Ihre Daten wurden erfolgreich gespeichert.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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

          {/* Email (read-only) */}
          <div>
            <label className="label">E-Mail</label>
            <input
              type="email"
              value={form.email}
              readOnly
              className="input-field bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-gray-400 text-xs mt-1">Die E-Mail-Adresse kann nicht geändert werden.</p>
          </div>

          {/* Phone */}
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

          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-emerald-700 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Speichern...
              </span>
            ) : 'Änderungen speichern'}
          </button>
        </form>
      </div>
    </div>
  )
}
