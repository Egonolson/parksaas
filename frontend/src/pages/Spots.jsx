import { useState, useEffect } from 'react'
import api from '../lib/api'
import Modal from '../components/Modal'
import SpotGrid from '../components/SpotGrid'

const STATUS_LABELS = {
  free: 'Frei',
  occupied: 'Belegt',
  reserved: 'Reserviert',
  inactive: 'Inaktiv',
}

export default function Spots() {
  const [spots, setSpots] = useState([])
  const [locations, setLocations] = useState([])
  const [filterLocation, setFilterLocation] = useState('all')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [form, setForm] = useState({ location_id: '', number: '', price: '' })
  const [bulkForm, setBulkForm] = useState({ location_id: '', prefix: 'Spot', from: 1, to: 20, price: '' })
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [locRes, spotsRes] = await Promise.all([
        api.get('/locations'),
        api.get('/spots'),
      ])
      setLocations(locRes.data.locations || locRes.data)
      setSpots(spotsRes.data.spots || spotsRes.data)
    } catch {
      setLocations([])
      setSpots([])
    } finally {
      setLoading(false)
    }
  }

  const filteredSpots = filterLocation === 'all'
    ? spots
    : spots.filter(s => String(s.location_id) === String(filterLocation))

  const stats = {
    total: filteredSpots.length,
    free: filteredSpots.filter(s => s.status === 'free').length,
    occupied: filteredSpots.filter(s => s.status === 'occupied').length,
    reserved: filteredSpots.filter(s => s.status === 'reserved').length,
  }

  const validateSpot = () => {
    const errs = {}
    if (!form.location_id) errs.location_id = 'Standort erforderlich'
    if (!form.number.trim()) errs.number = 'Nummer erforderlich'
    if (!form.price || isNaN(parseFloat(form.price))) errs.price = 'Gültiger Preis erforderlich'
    return errs
  }

  const handleCreateSpot = async (e) => {
    e.preventDefault()
    const errs = validateSpot()
    if (Object.keys(errs).length) { setFormErrors(errs); return }
    setSaving(true)
    try {
      const res = await api.post('/spots', {
        location_id: form.location_id,
        number: form.number,
        price: parseFloat(form.price),
      })
      setSpots(prev => [...prev, res.data])
      setModalOpen(false)
    } catch (err) {
      setFormErrors({ general: err.response?.data?.message || 'Fehler beim Anlegen' })
    } finally {
      setSaving(false)
    }
  }

  const handleBulkCreate = async (e) => {
    e.preventDefault()
    if (!bulkForm.location_id) { alert('Bitte Standort auswählen'); return }
    if (bulkForm.from >= bulkForm.to) { alert('Von muss kleiner als Bis sein'); return }
    setSaving(true)
    try {
      await api.post('/spots/bulk', {
        location_id: bulkForm.location_id,
        prefix: bulkForm.prefix,
        from: parseInt(bulkForm.from),
        to: parseInt(bulkForm.to),
        price: parseFloat(bulkForm.price) || 0,
      })
      await fetchData()
      setBulkModalOpen(false)
    } catch (err) {
      alert(err.response?.data?.message || 'Fehler beim Anlegen')
    } finally {
      setSaving(false)
    }
  }

  const getLocationName = (id) => locations.find(l => l.id === id)?.name || '-'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stellplätze</h1>
          <p className="text-gray-500 text-sm mt-1">
            {stats.total} Spots &bull; {stats.free} frei &bull; {stats.occupied} belegt
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setBulkModalOpen(true)} className="btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Bulk anlegen
          </button>
          <button onClick={() => { setForm({ location_id: '', number: '', price: '' }); setFormErrors({}); setModalOpen(true) }} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Spot anlegen
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Gesamt', val: stats.total, color: 'text-gray-700', bg: 'bg-gray-50' },
          { label: 'Frei', val: stats.free, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Belegt', val: stats.occupied, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Reserviert', val: stats.reserved, color: 'text-yellow-700', bg: 'bg-yellow-50' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 shrink-0">Standort:</label>
          <select
            value={filterLocation}
            onChange={e => setFilterLocation(e.target.value)}
            className="input-field max-w-xs"
          >
            <option value="all">Alle Standorte</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Spot Grid */}
      <div className="card p-5">
        {loading ? (
          <p className="text-center py-8 text-gray-400">Lade...</p>
        ) : (
          <SpotGrid spots={filteredSpots} />
        )}
      </div>

      {/* Table view */}
      {!loading && filteredSpots.length > 0 && (
        <div className="card mt-4 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-medium text-gray-700 text-sm">Listenansicht</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Nummer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Standort</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Preis/Monat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredSpots.map(spot => (
                  <tr key={spot.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{spot.number}</td>
                    <td className="px-4 py-3 text-gray-600">{getLocationName(spot.location_id)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                        spot.status === 'free' ? 'bg-green-100 text-green-800' :
                        spot.status === 'occupied' ? 'bg-red-100 text-red-700' :
                        spot.status === 'reserved' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          spot.status === 'free' ? 'bg-green-500' :
                          spot.status === 'occupied' ? 'bg-red-500' :
                          spot.status === 'reserved' ? 'bg-yellow-500' : 'bg-gray-400'
                        }`} />
                        {STATUS_LABELS[spot.status] || spot.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 font-medium">
                      {spot.price ? `${parseFloat(spot.price).toFixed(2)} EUR` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Stellplatz anlegen" size="sm">
        <form onSubmit={handleCreateSpot} className="space-y-4">
          {formErrors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{formErrors.general}</div>
          )}
          <div>
            <label className="label">Standort</label>
            <select
              className={`input-field ${formErrors.location_id ? 'border-red-400' : ''}`}
              value={form.location_id}
              onChange={e => setForm(p => ({ ...p, location_id: e.target.value }))}
            >
              <option value="">Standort auswählen...</option>
             {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
           </select>
           {formErrors.location_id && <p className="text-red-500 text-xs mt-1">{formErrors.location_id}</p>}
          </div>
          <div>
            <label className="label">Spot-Nummer / Bezeichnung</label>
            <input
              className={`input-field ${formErrors.number ? 'border-red-400' : ''}`}
              value={form.number}
              onChange={e => setForm(p => ({ ...p, number: e.target.value }))}
              placeholder="z.B. A-01"
            />
            {formErrors.number && <p className="text-red-500 text-xs mt-1">{formErrors.number}</p>}
          </div>
          <div>
            <label className="label">Monatlicher Preis (EUR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={`input-field ${formErrors.price ? 'border-red-400' : ''}`}
              value={form.price}
              onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
              placeholder="120.00"
            />
            {formErrors.price && <p className="text-red-500 text-xs mt-1">{formErrors.price}</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Abbrechen</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Anlegen...' : 'Anlegen'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Create Modal */}
      <Modal isOpen={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Spots in Bulk anlegen">
        <form onSubmit={handleBulkCreate} className="space-y-4">
          <p className="text-gray-500 text-sm">
            Legt mehrere Stellplätze auf einmal an. Die Bezeichnungen werden automatisch generiert (z.B. "Spot 1", "Spot 2", ...).
          </p>
          <div>
            <label className="label">Standort</label>
            <select
              className="input-field"
              value={bulkForm.location_id}
              onChange={e => setBulkForm(p => ({ ...p, location_id: e.target.value }))}
            >
              <option value="">Standort auswählen...</option>
             {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
           </select>
         </div>
         <div>
            <label className="label">Präfix (Bezeichnung)</label>
            <input
              className="input-field"
              value={bulkForm.prefix}
              onChange={e => setBulkForm(p => ({ ...p, prefix: e.target.value }))}
              placeholder="Spot"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Von (Nummer)</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={bulkForm.from}
                onChange={e => setBulkForm(p => ({ ...p, from: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Bis (Nummer)</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={bulkForm.to}
                onChange={e => setBulkForm(p => ({ ...p, to: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Monatlicher Preis (EUR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input-field"
              value={bulkForm.price}
              onChange={e => setBulkForm(p => ({ ...p, price: e.target.value }))}
              placeholder="120.00"
            />
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-700">
            Es werden {Math.max(0, parseInt(bulkForm.to || 0) - parseInt(bulkForm.from || 0) + 1)} Spots angelegt:
            "{bulkForm.prefix} {bulkForm.from}" bis "{bulkForm.prefix} {bulkForm.to}"
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setBulkModalOpen(false)} className="btn-secondary flex-1">Abbrechen</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Anlegen...' : 'Spots anlegen'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
