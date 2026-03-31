import { useState, useEffect } from 'react'
import api from '../lib/api'
import Modal from '../components/Modal'

const EMPTY_FORM = { name: '', address: '', zip: '', city: '' }

const MOCK_LOCATIONS = [
  { id: 1, name: 'Parkhaus Nord', address: 'Nordstrasse 12', zip: '20097', city: 'Hamburg', spot_count: 24, available_spots: 8 },
  { id: 2, name: 'Parkplatz Sued', address: 'Suedalle 5', zip: '20099', city: 'Hamburg', spot_count: 12, available_spots: 3 },
  { id: 3, name: 'Tiefgarage West', address: 'Westweg 99', zip: '22305', city: 'Hamburg', spot_count: 50, available_spots: 20 },
]

export default function Locations() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editLocation, setEditLocation] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const res = await api.get('/locations')
      setLocations(res.data.locations || res.data)
    } catch {
      setLocations(MOCK_LOCATIONS)
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditLocation(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setModalOpen(true)
  }

  const openEdit = (loc) => {
    setEditLocation(loc)
    setForm({ name: loc.name, address: loc.address, zip: loc.zip, city: loc.city })
    setFormErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name ist erforderlich'
    if (!form.address.trim()) errs.address = 'Adresse ist erforderlich'
    if (!form.zip.trim()) errs.zip = 'PLZ ist erforderlich'
    if (!form.city.trim()) errs.city = 'Stadt ist erforderlich'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setFormErrors(errs); return }
    setSaving(true)
    try {
      if (editLocation) {
        const res = await api.put(`/locations/${editLocation.id}`, form)
        setLocations(prev => prev.map(l => l.id === editLocation.id ? { ...l, ...res.data } : l))
      } else {
        const res = await api.post('/locations', form)
        setLocations(prev => [...prev, res.data])
      }
      setModalOpen(false)
    } catch (err) {
      setFormErrors({ general: err.response?.data?.message || 'Fehler beim Speichern' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/locations/${id}`)
      setLocations(prev => prev.filter(l => l.id !== id))
    } catch {
      alert('Fehler beim Loeschen')
    }
    setDeleteConfirm(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Standorte</h1>
          <p className="text-gray-500 text-sm mt-1">{locations.length} Standort{locations.length !== 1 ? 'e' : ''} insgesamt</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Standort anlegen
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Lade...</div>
      ) : locations.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          <p className="text-gray-500 font-medium mb-1">Noch keine Standorte</p>
          <p className="text-gray-400 text-sm mb-4">Legen Sie Ihren ersten Standort an, um zu beginnen.</p>
          <button onClick={openCreate} className="btn-primary mx-auto">Ersten Standort anlegen</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {locations.map(loc => (
            <div key={loc.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(loc)}
                    className="p-1.5 text-gray-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(loc)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{loc.name}</h3>
              <p className="text-gray-500 text-sm">{loc.address}</p>
              <p className="text-gray-400 text-sm">{loc.zip} {loc.city}</p>
              <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{loc.spot_count || 0}</p>
                  <p className="text-xs text-gray-400">Spots gesamt</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-green-600">{loc.available_spots || 0}</p>
                  <p className="text-xs text-gray-400">Verfuegbar</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-red-500">{(loc.spot_count || 0) - (loc.available_spots || 0)}</p>
                  <p className="text-xs text-gray-400">Belegt</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editLocation ? 'Standort bearbeiten' : 'Neuen Standort anlegen'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formErrors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {formErrors.general}
            </div>
          )}
          <div>
            <label className="label">Name des Standorts</label>
            <input
              className={`input-field ${formErrors.name ? 'border-red-400' : ''}`}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="z.B. Parkhaus Mitte"
            />
            {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
          </div>
          <div>
            <label className="label">Adresse</label>
            <input
              className={`input-field ${formErrors.address ? 'border-red-400' : ''}`}
              value={form.address}
              onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
              placeholder="Musterstrasse 1"
            />
            {formErrors.address && <p className="text-red-500 text-xs mt-1">{formErrors.address}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">PLZ</label>
              <input
                className={`input-field ${formErrors.zip ? 'border-red-400' : ''}`}
                value={form.zip}
                onChange={e => setForm(p => ({ ...p, zip: e.target.value }))}
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
                onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                placeholder="Hamburg"
              />
              {formErrors.city && <p className="text-red-500 text-xs mt-1">{formErrors.city}</p>}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Abbrechen</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Speichern...' : editLocation ? 'Speichern' : 'Anlegen'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Standort loeschen"
        size="sm"
      >
        <p className="text-gray-600 text-sm mb-5">
          Moechten Sie <strong>{deleteConfirm?.name}</strong> wirklich loeschen?
          Alle zugehoerigen Stellplaetze werden ebenfalls geloescht.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Abbrechen</button>
          <button onClick={() => handleDelete(deleteConfirm.id)} className="btn-danger flex-1">Loeschen</button>
        </div>
      </Modal>
    </div>
  )
}
