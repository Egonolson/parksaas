import { useState, useEffect } from 'react'
import api from '../lib/api'

const STATUS_BADGE = {
  paid: <span className="badge-active">Bezahlt</span>,
  pending: <span className="badge-pending">Ausstehend</span>,
  failed: <span className="badge-failed">Fehlgeschlagen</span>,
  open: <span className="badge-pending">Offen</span>,
  refunded: <span className="badge-inactive">Erstattet</span>,
}

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState('')

  useEffect(() => {
    api.get('/payments')
      .then(res => setPayments(res.data.payments || res.data))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false))
  }, [])

  // Generate month options
  const months = [...new Set(payments.map(p => p.created_at?.substring(0, 7)))].sort().reverse()

  const filtered = monthFilter
    ? payments.filter(p => p.created_at?.startsWith(monthFilter))
    : payments

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount || 0)

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const totalAmount = filtered.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
  const totalFees = filtered.filter(p => p.status === 'paid').reduce((s, p) => s + (p.platform_fee || 0), 0)
  const pendingAmount = filtered.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Zahlungen</h1>
        <p className="text-gray-500 text-sm mt-1">Alle Transaktionen im Überblick</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Einnahmen (Zeitraum)</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Bezahlte Transaktionen</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Plattform-Fees</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalFees)}</p>
          <p className="text-xs text-gray-400 mt-0.5">ParkSaaS-Provision</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Ausstehend</p>
          <p className="text-2xl font-bold text-yellow-600">{formatCurrency(pendingAmount)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Noch nicht eingegangen</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 shrink-0">Monat:</label>
          <select
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            className="input-field max-w-xs"
          >
            <option value="">Alle Monate</option>
            {months.map(m => (
              <option key={m} value={m}>
                {new Date(m + '-01').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </select>
          {monthFilter && (
            <button onClick={() => setMonthFilter('')} className="text-gray-400 hover:text-gray-600 text-sm">
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Datum</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Kunde</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Spot</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Methode</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Betrag</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Plattform-Fee</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Auszahlung</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">Lade...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">Keine Zahlungen gefunden</td></tr>
              ) : filtered.map(payment => (
                <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3.5 text-gray-600">{formatDate(payment.created_at)}</td>
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-gray-900">{payment.customer_name}</span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-600">{payment.spot_number}</td>
                  <td className="px-4 py-3.5 text-gray-500 text-xs">{payment.method || '-'}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-gray-900">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-red-500 text-xs">
                    -{formatCurrency(payment.platform_fee)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium text-green-700 text-xs">
                    {formatCurrency((payment.amount || 0) - (payment.platform_fee || 0))}
                  </td>
                  <td className="px-4 py-3.5">
                    {STATUS_BADGE[payment.status] || STATUS_BADGE.pending}
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-500">Summe</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totalAmount)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-500 text-xs">-{formatCurrency(totalFees)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700 text-xs">
                    {formatCurrency(totalAmount - totalFees)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
