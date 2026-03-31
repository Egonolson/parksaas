import { useState, useEffect } from 'react'
import api from '../lib/api'
import Modal from '../components/Modal'

const MOCK_CONTRACTS = [
  { id: 1, customer_name: 'Max Mustermann', customer_email: 'max@example.de', spot_number: 'A-01', location_name: 'Parkhaus Nord', status: 'active', monthly_amount: 120, started_at: '2024-01-01', phone: '+49 170 1234567', address: 'Musterweg 1, 20095 Hamburg', license_plate: 'HH-MM 123' },
  { id: 2, customer_name: 'Anna Schmidt', customer_email: 'anna@example.de', spot_number: 'B-05', location_name: 'Parkhaus Nord', status: 'active', monthly_amount: 95, started_at: '2023-11-15', phone: '+49 171 9876543', address: 'Schmidtstr. 5, 20097 Hamburg', license_plate: 'HH-AS 456' },
  { id: 3, customer_name: 'Tom Weber', customer_email: 'tom@example.de', spot_number: 'A-12', location_name: 'Parkplatz Sued', status: 'pending', monthly_amount: 150, started_at: '2024-01-10', phone: '+49 172 5552233', address: 'Weberweg 3, 22305 Hamburg', license_plate: 'HH-TW 789' },
  { id: 4, customer_name: 'Lisa Bauer', customer_email: 'lisa@example.de', spot_number: 'C-03', location_name: 'Parkhaus Nord', status: 'active', monthly_amount: 120, started_at: '2023-09-01', phone: '+49 173 4441122', address: 'Bauerstr. 8, 20099 Hamburg', license_plate: 'HH-LB 321' },
  { id: 5, customer_name: 'Klaus Hoffmann', customer_email: 'klaus@example.de', spot_number: 'A-07', location_name: 'Tiefgarage West', status: 'inactive', monthly_amount: 80, started_at: '2023-06-15', phone: '+49 174 7778899', address: 'Hoffmanngasse 12, 22305 Hamburg', license_plate: 'HH-KH 654' },
]

const STATUS_CONFIG = {
  active: { label: 'Aktiv', className: 'badge-active' },
  pending: { label: 'Ausstehend', className: 'badge-pending' },
  inactive: { label: 'Inaktiv', className: 'badge-inactive' },
  cancelled: { label: 'Gekuendigt', className: 'badge-failed' },
}

export default function Contracts() {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedContract, setSelectedContract] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/contracts')
      .then(res => setContracts(res.data.contracts || res.data))
      .catch(() => setContracts(MOCK_CONTRACTS))
      .finally(() => setLoading(false))
  }, [])

  const filtered = contracts.filter(c =>
    c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
    c.spot_number?.toLowerCase().includes(search.toLowerCase())
  )

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const activeCount = contracts.filter(c => c.status === 'active').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vertraege</h1>
          <p className="text-gray-500 text-sm mt-1">{activeCount} aktive Mietverhaeltnisse</p>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4 mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="input-field pl-9"
            placeholder="Suchen nach Name, E-Mail, Spot..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Kunde</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Spot</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Betrag/Monat</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Seit</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">Lade...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">Keine Vertraege gefunden</td>
                </tr>
              ) : filtered.map(contract => {
                const statusCfg = STATUS_CONFIG[contract.status] || STATUS_CONFIG.inactive
                return (
                  <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-gray-900">{contract.customer_name}</div>
                      <div className="text-xs text-gray-400">{contract.customer_email}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-gray-800">{contract.spot_number}</div>
                      <div className="text-xs text-gray-400">{contract.location_name}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={statusCfg.className}>{statusCfg.label}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gray-900">
                      {formatCurrency(contract.monthly_amount)}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">
                      {formatDate(contract.started_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setSelectedContract(contract)}
                        className="text-blue-700 hover:text-blue-900 text-xs font-medium hover:underline"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedContract}
        onClose={() => setSelectedContract(null)}
        title="Vertragsdetails"
        size="md"
      >
        {selectedContract && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-800 font-bold text-lg">
                  {selectedContract.customer_name?.[0]?.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selectedContract.customer_name}</p>
                <p className="text-gray-500 text-sm">{selectedContract.customer_email}</p>
              </div>
              <div className="ml-auto">
                <span className={STATUS_CONFIG[selectedContract.status]?.className || 'badge-inactive'}>
                  {STATUS_CONFIG[selectedContract.status]?.label || selectedContract.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Stellplatz</p>
                <p className="text-gray-900 font-medium">{selectedContract.spot_number}</p>
                <p className="text-gray-400 text-xs">{selectedContract.location_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Monatlicher Betrag</p>
                <p className="text-gray-900 font-bold text-lg">
                  {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(selectedContract.monthly_amount)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Telefon</p>
                <p className="text-gray-700">{selectedContract.phone || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Kennzeichen</p>
                <p className="text-gray-700 font-mono">{selectedContract.license_plate || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Adresse</p>
                <p className="text-gray-700">{selectedContract.address || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Vertrag seit</p>
                <p className="text-gray-700">{formatDate(selectedContract.started_at)}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => setSelectedContract(null)} className="btn-secondary flex-1">Schliessen</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
