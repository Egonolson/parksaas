import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import StatsCard from '../components/StatsCard'
import api from '../lib/api'

const STATUS_BADGE = {
  paid: <span className="badge-active">Bezahlt</span>,
  pending: <span className="badge-pending">Ausstehend</span>,
  failed: <span className="badge-failed">Fehlgeschlagen</span>,
  open: <span className="badge-pending">Offen</span>,
}

const EMPTY_STATS = {
  active_contracts: 0,
  available_spots: 0,
  monthly_revenue: 0,
  pending_amount: 0,
}

export default function Dashboard() {
  const { operator } = useAuth()
  const [stats, setStats] = useState(EMPTY_STATS)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, paymentsRes] = await Promise.all([
          api.get('/operators/stats'),
          api.get('/payments?limit=5'),
        ])
        setStats(statsRes.data)
        setPayments(paymentsRes.data.payments || paymentsRes.data)
      } catch {
        // Show empty state on error
        setStats(EMPTY_STATS)
        setPayments([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div>
      {/* Onboarding Banner */}
      {operator && !operator.onboarding_completed && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-amber-800 text-sm">Onboarding noch nicht abgeschlossen</p>
              <p className="text-amber-600 text-xs mt-0.5">Schließen Sie die Einrichtung ab, um alle Funktionen zu nutzen.</p>
            </div>
          </div>
          <Link
            to="/onboarding"
            className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors shrink-0"
          >
            Onboarding fortsetzen
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Guten Tag, {operator?.company_name || 'Operator'}!
        </h1>
        <p className="text-gray-500 text-sm mt-1">Hier ist eine Übersicht Ihrer Parkplatz-Aktivitäten.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Aktive Verträge"
          value={stats.active_contracts}
          subtitle="Laufende Mietverhältnisse"
          color="blue"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatsCard
          title="Verfügbare Spots"
          value={stats.available_spots}
          subtitle="Sofort vermietbar"
          color="green"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Monatsumsatz"
          value={formatCurrency(stats.monthly_revenue)}
          subtitle="Aktueller Monat"
          color="blue"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Ausstehend"
          value={formatCurrency(stats.pending_amount)}
          subtitle="Offene Zahlungen"
          color="yellow"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Payments */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Letzte Zahlungen</h2>
            <Link to="/payments" className="text-emerald-600 hover:text-emerald-700 text-xs font-medium">
              Alle anzeigen
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              <div className="py-8 text-center text-gray-400 text-sm">Lade...</div>
            ) : payments.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">Noch keine Zahlungen</div>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-emerald-700 text-xs font-bold">
                      {payment.customer_name?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{payment.customer_name}</p>
                    <p className="text-xs text-gray-400">{formatDate(payment.created_at)} &bull; Spot {payment.spot_number}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(payment.amount)}</p>
                    <div className="mt-0.5">{STATUS_BADGE[payment.status] || STATUS_BADGE.pending}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Schnellzugriff</h2>
          <div className="space-y-2">
            <Link
              to="/locations"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-50 transition-colors group"
            >
              <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Standorte</p>
                <p className="text-xs text-gray-400">Verwalten & anlegen</p>
              </div>
            </Link>

            <Link
              to="/spots"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-50 transition-colors group"
            >
              <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Stellplätze</p>
                <p className="text-xs text-gray-400">Übersicht & Status</p>
              </div>
            </Link>

            <Link
              to="/contracts"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-50 transition-colors group"
            >
              <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Verträge</p>
                <p className="text-xs text-gray-400">Aktive Mietverhältnisse</p>
              </div>
            </Link>

            {operator?.slug && (
              <a
                href={`/park/${operator.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-emerald-50 transition-colors group"
              >
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Buchungsseite</p>
                  <p className="text-xs text-gray-400">parksaas.de/park/{operator.slug}</p>
                </div>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
