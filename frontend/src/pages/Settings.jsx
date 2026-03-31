import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'

export default function Settings() {
  const { operator, updateOperator } = useAuth()
  const [profileForm, setProfileForm] = useState({
    company_name: operator?.company_name || '',
    email: operator?.email || '',
    phone: operator?.phone || '',
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState(null)

  const [mollieConnected, setMollieConnected] = useState(operator?.mollie_connected || false)
  const [mollieLoading, setMollieLoading] = useState(false)
  const [commissionRate, setCommissionRate] = useState(operator?.commission_rate || 3)

  useEffect(() => {
    // Fetch current operator info
    api.get('/operators/me')
      .then(res => {
        const data = res.data
        setProfileForm({
          company_name: data.company_name || '',
          email: data.email || '',
          phone: data.phone || '',
        })
        setMollieConnected(data.mollie_connected || false)
        setCommissionRate(data.commission_rate || 3)
      })
      .catch(() => {})
  }, [])

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

  const handleMollieConnect = async () => {
    setMollieLoading(true)
    try {
      const res = await api.get('/operators/mollie/connect')
      if (res.data.redirect_url) {
        window.location.href = res.data.redirect_url
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Mollie-Verbindung fehlgeschlagen')
    } finally {
      setMollieLoading(false)
    }
  }

  const handleMollieDisconnect = async () => {
    if (!confirm('Mollie-Verbindung wirklich trennen? Automatische Zahlungen werden gestoppt.')) return
    try {
      await api.delete('/operators/mollie/disconnect')
      setMollieConnected(false)
      updateOperator({ mollie_connected: false })
    } catch {
      alert('Fehler beim Trennen der Mollie-Verbindung')
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
        <p className="text-gray-500 text-sm mt-1">Verwalten Sie Ihr Konto und Zahlungseinstellungen</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Mollie Section */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Mollie Zahlungsverbindung</h2>
          <p className="text-gray-500 text-sm mb-5">
            Verbinden Sie Ihr Mollie-Konto, um Zahlungen von Ihren Mietern automatisch einzuziehen.
          </p>

          {mollieConnected ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex-1">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-green-800 font-semibold text-sm">Mollie verbunden</p>
                  <p className="text-green-600 text-xs">Zahlungsempfang aktiv</p>
                </div>
              </div>
              <button
                onClick={handleMollieDisconnect}
                className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
              >
                Trennen
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex-1">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-amber-800 font-semibold text-sm">Nicht verbunden</p>
                  <p className="text-amber-600 text-xs">Zahlungsempfang inaktiv</p>
                </div>
              </div>
              <button
                onClick={handleMollieConnect}
                disabled={mollieLoading}
                className="bg-[#FF7F40] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#e86e30] transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                {mollieLoading ? 'Verbinden...' : 'Mit Mollie verbinden'}
              </button>
            </div>
          )}

          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500">
              <strong>Wie funktioniert es?</strong> Klicken Sie auf "Mit Mollie verbinden" und autorisieren Sie ParkSaaS
              in Ihrem Mollie-Dashboard. Anschliessend werden Zahlungen automatisch auf Ihr Mollie-Konto ueberwiesen,
              abzueglich der ParkSaaS-Provision.
            </p>
          </div>
        </div>

        {/* Commission */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Kommissionssatz</h2>
          <p className="text-gray-500 text-sm mb-4">
            ParkSaaS erhebt eine Provision auf alle verarbeiteten Zahlungen.
          </p>
          <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <span className="text-blue-800 font-bold text-lg">{commissionRate}%</span>
            </div>
            <div>
              <p className="font-semibold text-blue-900">Ihr aktueller Satz: {commissionRate}%</p>
              <p className="text-blue-700 text-xs mt-0.5">
                Bei EUR 100 Zahlung erhalten Sie EUR {(100 - commissionRate).toFixed(2)} ausgezahlt.
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Fuer angepasste Kommissionssaetze wenden Sie sich bitte an support@parksaas.de
          </p>
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
                Oeffnen
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
            Diese Aktionen koennen nicht rueckgaengig gemacht werden.
          </p>
          <button
            onClick={() => confirm('Konto wirklich loeschen? Diese Aktion ist permanent.') && alert('Bitte kontaktieren Sie support@parksaas.de')}
            className="btn-danger"
          >
            Konto loeschen
          </button>
        </div>
      </div>
    </div>
  )
}
