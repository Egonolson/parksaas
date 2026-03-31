import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function Register() {
  const [form, setForm] = useState({
    company_name: '',
    email: '',
    password: '',
    password_confirm: '',
    slug: '',
  })
  const [errors, setErrors] = useState({})
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const { register, loading } = useAuth()
  const navigate = useNavigate()

  const validate = () => {
    const errs = {}
    if (!form.company_name.trim()) errs.company_name = 'Firmenname ist erforderlich'
    if (!form.email) errs.email = 'E-Mail ist erforderlich'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Ungueltige E-Mail'
    if (!form.password) errs.password = 'Passwort ist erforderlich'
    else if (form.password.length < 8) errs.password = 'Mindestens 8 Zeichen'
    if (form.password !== form.password_confirm) errs.password_confirm = 'Passwoerter stimmen nicht ueberein'
    if (!form.slug) errs.slug = 'URL-Slug ist erforderlich'
    else if (!/^[a-z0-9-]+$/.test(form.slug)) errs.slug = 'Nur Kleinbuchstaben, Zahlen und Bindestriche'
    else if (form.slug.length < 3) errs.slug = 'Mindestens 3 Zeichen'
    return errs
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => {
      const updated = { ...prev, [name]: value }
      if (name === 'company_name' && !slugManuallyEdited) {
        updated.slug = slugify(value)
      }
      return updated
    })
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  const handleSlugChange = (e) => {
    setSlugManuallyEdited(true)
    const val = slugify(e.target.value) || e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setForm(prev => ({ ...prev, slug: val }))
    if (errors.slug) setErrors(prev => ({ ...prev, slug: null }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    const result = await register({
      company_name: form.company_name,
      email: form.email,
      password: form.password,
      slug: form.slug,
    })
    if (result.success) {
      navigate('/dashboard')
    } else {
      setErrors({ general: result.error })
    }
  }

  const slugIsValid = form.slug && /^[a-z0-9-]+$/.test(form.slug) && form.slug.length >= 3

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-800 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <span className="text-blue-900 font-bold text-2xl">ParkSaaS</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-1">Konto erstellen</h1>
          <p className="text-gray-500 text-sm">Starten Sie kostenlos - keine Kreditkarte erforderlich</p>
        </div>

        <div className="card p-8">
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Firmenname</label>
              <input
                type="text"
                name="company_name"
                value={form.company_name}
                onChange={handleChange}
                className={`input-field ${errors.company_name ? 'border-red-400' : ''}`}
                placeholder="Parkhaus GmbH"
                autoFocus
              />
              {errors.company_name && <p className="text-red-500 text-xs mt-1">{errors.company_name}</p>}
            </div>

            <div>
              <label className="label">E-Mail</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className={`input-field ${errors.email ? 'border-red-400' : ''}`}
                placeholder="max@example.de"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="label">Passwort</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className={`input-field ${errors.password ? 'border-red-400' : ''}`}
                placeholder="Mindestens 8 Zeichen"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <div>
              <label className="label">Passwort bestaetigen</label>
              <input
                type="password"
                name="password_confirm"
                value={form.password_confirm}
                onChange={handleChange}
                className={`input-field ${errors.password_confirm ? 'border-red-400' : ''}`}
                placeholder="Passwort wiederholen"
              />
              {errors.password_confirm && <p className="text-red-500 text-xs mt-1">{errors.password_confirm}</p>}
            </div>

            <div>
              <label className="label">Ihre URL (Slug)</label>
              <input
                type="text"
                value={form.slug}
                onChange={handleSlugChange}
                className={`input-field ${errors.slug ? 'border-red-400' : slugIsValid ? 'border-green-400' : ''}`}
                placeholder="mein-parkhaus"
              />
              {errors.slug && <p className="text-red-500 text-xs mt-1">{errors.slug}</p>}

              {/* Slug preview */}
              <div className={`mt-2 px-3 py-2 rounded-lg text-xs border ${slugIsValid ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <span className="text-gray-400">Ihre Buchungsseite: </span>
                <span className="font-medium text-gray-700">parksaas.de/park/</span>
                <span className={`font-semibold ${slugIsValid ? 'text-green-700' : 'text-gray-400'}`}>
                  {form.slug || 'mein-slug'}
                </span>
              </div>
              <p className="text-gray-400 text-xs mt-1">Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-800 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Registrieren...
                </span>
              ) : 'Konto erstellen'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4 px-4">
          Mit der Registrierung stimmen Sie unseren{' '}
          <a href="#" className="text-blue-700 hover:underline">AGB</a>
          {' '}und der{' '}
          <a href="#" className="text-blue-700 hover:underline">Datenschutzerklaerung</a> zu.
        </p>

        <p className="text-center text-sm text-gray-500 mt-4">
          Bereits registriert?{' '}
          <Link to="/login" className="text-blue-800 font-medium hover:underline">
            Jetzt anmelden
          </Link>
        </p>
      </div>
    </div>
  )
}
