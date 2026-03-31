const STATUS_COLORS = {
  free: {
    bg: 'bg-green-100 border-green-300 hover:bg-green-200',
    text: 'text-green-800',
    dot: 'bg-green-500',
    label: 'Frei',
  },
  occupied: {
    bg: 'bg-red-100 border-red-300',
    text: 'text-red-800',
    dot: 'bg-red-500',
    label: 'Belegt',
  },
  reserved: {
    bg: 'bg-yellow-100 border-yellow-300',
    text: 'text-yellow-800',
    dot: 'bg-yellow-500',
    label: 'Reserviert',
  },
  inactive: {
    bg: 'bg-gray-100 border-gray-300',
    text: 'text-gray-500',
    dot: 'bg-gray-400',
    label: 'Inaktiv',
  },
}

function SpotItem({ spot, onClick, interactive = false }) {
  const status = STATUS_COLORS[spot.status] || STATUS_COLORS.inactive
  const isClickable = interactive && spot.status === 'free'

  return (
    <button
      onClick={() => isClickable && onClick && onClick(spot)}
      disabled={!isClickable}
      className={`
        relative border-2 rounded-lg p-3 text-center transition-all
        ${status.bg}
        ${isClickable ? 'cursor-pointer shadow-sm hover:shadow-md' : 'cursor-default'}
        ${spot.selected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
      `}
    >
      <div className={`text-xs font-bold ${status.text}`}>{spot.number}</div>
      <div className={`w-2 h-2 rounded-full mx-auto mt-1 ${status.dot}`} />
    </button>
  )
}

export default function SpotGrid({ spots, onSpotClick, interactive = false, selectedSpot = null }) {
  const spotsWithSelection = spots.map(s => ({
    ...s,
    selected: selectedSpot?.id === s.id
  }))

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(STATUS_COLORS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <div className={`w-3 h-3 rounded-full ${val.dot}`} />
            {val.label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
        {spotsWithSelection.map((spot) => (
          <SpotItem
            key={spot.id}
            spot={spot}
            onClick={onSpotClick}
            interactive={interactive}
          />
        ))}
      </div>
      {spots.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">Keine Stellplaetze gefunden</p>
        </div>
      )}
    </div>
  )
}
