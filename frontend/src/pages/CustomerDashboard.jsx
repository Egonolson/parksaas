import { useState, useEffect } from 'react'
import api from '../lib/api'

const STATUS_BADGE = {
  aktiv: 'bg-green-100 text-green-700 border-green-200',
  active: 'bg-green-100 text-green-700 border-green-200',
  beendet: 'bg-gray-100 text-gray-600 border-gray-200',
  ended: 'bg-gray-100 text-gray-600 border-gray-200',
  completed: 'bg-gray-100 text-gray-600 border-gray-200',
  reserviert: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  reserved: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}

const INVOICE_STATUS_BADGE = {
  ausgestellt: 'bg-blue-100 text-blue-700 border-blue-200',
  issued: 'bg-blue-100 text-blue-700 border-blue-200',
  bezahlt: 'bg-green-100 text-green-700 border-green-200',
  paid: 'bg-green-100 text-green-700 border-green-200',
  storniert: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
}

const STATUS_LABEL = {
  active: 'aktiv',
  aktiv: 'aktiv',
  ended: 'beendet',
  beendet: 'beendet',
  completed: 'beendet',
  reserved: 'reserviert',
  reserviert: 'reserviert',
  pending: 'reserviert',
}

const INVOICE_STATUS_LABEL = {
  issued: 'ausgestellt',
  ausgestellt: 'ausgestellt',
  paid: 'bezahlt',
  bezahlt: 'bezahlt',
  cancelled: 'storniert',
  storniert: 'storniert',
}

const formatPrice = (amount) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount || 0)

const formatDate = (dateStr) => {
  if (!dateStr) return '–'
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function CustomerDashboard() {
  const [bookings, setBookings] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get('/customer/bookings')
        setBookings(res.data.bookings || res.data || [])
      } catch (err) {
        console.error('Fehler beim Laden der Buchungen:', err)
      } finally {
        setLoadingBookings(false)
      }
    }
    const fetchInvoices = async () => {
      try {
        const res = await api.get('/customer/invoices')
        setInvoices(res.data.invoices || res.data || [])
      } catch (err) {
        console.error('Fehler beim Laden der Rechnungen:', err)
      } finally {
        setLoadingInvoices(false)
      }
    }
    fetchBookings()
    fetchInvoices()
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meine Übersicht</h1>
        <p className="text-gray-500 text-sm mt-1">Ihre Buchungen und Rechnungen auf einen Blick</p>
      </div>

      {/* Bookings */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Meine Buchungen
          </h2>
        </div>

        {loadingBookings ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Buchungen werden geladen...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">Keine Buchungen vorhanden</p>
            <p className="text-gray-400 text-sm mt-1">Ihre Buchungen werden hier angezeigt, sobald Sie einen Stellplatz buchen.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Standort</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Stellplatz</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Startdatum</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Enddatum</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">Betrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.map((b, i) => {
                  const statusKey = (b.status || '').toLowerCase()
                  return (
                    <tr key={b.id || i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-gray-800">{b.location_name || b.location || '–'}</td>
                      <td className="px-6 py-3 text-gray-800 font-mono">{b.spot_number || b.spot || '–'}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[statusKey] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {STATUS_LABEL[statusKey] || b.status || '–'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-600">{formatDate(b.start_date || b.starts_at)}</td>
                      <td className="px-6 py-3 text-gray-600">{formatDate(b.end_date || b.ends_at)}</td>
                      <td className="px-6 py-3 text-right font-medium text-gray-800">{formatPrice(b.amount || b.price)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Meine Rechnungen
          </h2>
        </div>

        {loadingInvoices ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Rechnungen werden geladen...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">Keine Rechnungen vorhanden</p>
            <p className="text-gray-400 text-sm mt-1">Ihre Rechnungen erscheinen hier nach einer abgeschlossenen Buchung.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Rechnungsnr.</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Datum</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">Betrag (brutto)</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-500">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv, i) => {
                  const statusKey = (inv.status || '').toLowerCase()
                  return (
                    <tr key={inv.id || i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-gray-800 font-mono">{inv.invoice_number || inv.number || '–'}</td>
                      <td className="px-6 py-3 text-gray-600">{formatDate(inv.date || inv.created_at || inv.issued_at)}</td>
                      <td className="px-6 py-3 text-right font-medium text-gray-800">{formatPrice(inv.amount_gross || inv.total || inv.amount)}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${INVOICE_STATUS_BADGE[statusKey] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {INVOICE_STATUS_LABEL[statusKey] || inv.status || '–'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => {
                            if (inv.pdf_url || inv.download_url) {
                              window.open(inv.pdf_url || inv.download_url, '_blank')
                            }
                          }}
                          className="text-emerald-600 hover:text-emerald-700 text-xs font-medium hover:underline"
                        >
                          Herunterladen
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
