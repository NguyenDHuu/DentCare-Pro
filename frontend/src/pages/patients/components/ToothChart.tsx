import { useState } from 'react'
import { TOOTH_STATUS_META, type ToothChartData, type ToothStatus } from '../../../api/patients.api'

// ─── FDI Two-Digit Notation layout ───────────────────────────
//  Upper: [18..11 | 21..28]
//  Lower: [48..41 | 31..38]

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38]

// Molar = wider, incisor = narrow
const toothWidth = (n: number): number => {
  const t = n % 10
  if (t >= 6) return 44   // molars (6,7,8)
  if (t === 5 || t === 4) return 38 // premolars
  if (t === 3) return 36  // canine
  return 32               // incisors (1,2)
}

const STATUS_CYCLE: ToothStatus[] = [
  'HEALTHY', 'CAVITY', 'FILLED', 'CROWN', 'IMPLANT', 'NEEDS_TREATMENT', 'MISSING',
]

function nextStatus(current: ToothStatus): ToothStatus {
  const idx = STATUS_CYCLE.indexOf(current)
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
}

// ─── Single Tooth ─────────────────────────────────────────────

function Tooth({
  number, data, editable, onClick,
}: {
  number: number
  data: { status: ToothStatus; notes?: string } | undefined
  editable: boolean
  onClick: (n: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  const status = data?.status ?? 'HEALTHY'
  const meta   = TOOTH_STATUS_META[status]
  const w      = toothWidth(number)
  const isMissing = status === 'MISSING'

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Tooth number label */}
      <span style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '3px', fontWeight: 500 }}>
        {number}
      </span>

      {/* Tooth box */}
      <div
        onClick={() => editable && onClick(number)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={`${number}: ${meta.label}${data?.notes ? ' – ' + data.notes : ''}`}
        style={{
          width:  `${w}px`,
          height: '48px',
          borderRadius: '6px 6px 4px 4px',
          backgroundColor: meta.bg,
          border: `2px solid ${hovered && editable ? '#2563eb' : meta.border}`,
          cursor:  editable ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 0.15s',
          position: 'relative',
          boxShadow: hovered && editable ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
          opacity: isMissing ? 0.4 : 1,
        }}
      >
        {isMissing ? (
          <span style={{ fontSize: '16px', color: '#9ca3af', fontWeight: 700 }}>×</span>
        ) : (
          <span style={{ fontSize: '10px', fontWeight: 700, color: meta.text }}>
            {status === 'HEALTHY' ? '' : status.slice(0, 2)}
          </span>
        )}
        {/* Dot indicator */}
        {status !== 'HEALTHY' && !isMissing && (
          <div style={{
            position: 'absolute', bottom: '4px', width: '6px', height: '6px',
            borderRadius: '50%', backgroundColor: meta.border,
          }} />
        )}
      </div>
    </div>
  )
}

// ─── Quadrant row ─────────────────────────────────────────────

function QuadrantRow({
  teeth, chart, editable, onToggle, align,
}: {
  teeth: number[]
  chart: ToothChartData
  editable: boolean
  onToggle: (n: number) => void
  align: 'right' | 'left'
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: align === 'right' ? 'row-reverse' : 'row',
      gap: '3px',
    }}>
      {teeth.map(n => (
        <Tooth key={n} number={n} data={chart[String(n)]} editable={editable} onClick={onToggle} />
      ))}
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────

function Legend() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
      {(Object.entries(TOOTH_STATUS_META) as [ToothStatus, typeof TOOTH_STATUS_META[ToothStatus]][]).map(([status, m]) => (
        <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{
            width: '14px', height: '14px', borderRadius: '3px',
            backgroundColor: m.bg, border: `2px solid ${m.border}`, flexShrink: 0,
          }} />
          <span style={{ fontSize: '11px', color: '#6b7280' }}>{m.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

interface Props {
  chart:    ToothChartData
  editable: boolean
  onChange?: (chart: ToothChartData) => void
}

export default function ToothChart({ chart, editable, onChange }: Props) {
  const handleToggle = (n: number) => {
    if (!onChange) return
    const key    = String(n)
    const current: ToothStatus = chart[key]?.status ?? 'HEALTHY'
    const next   = nextStatus(current)
    const newChart = { ...chart }
    if (next === 'HEALTHY') {
      delete newChart[key]
    } else {
      newChart[key] = { status: next, notes: chart[key]?.notes }
    }
    onChange(newChart)
  }

  return (
    <div style={{ userSelect: 'none' }}>
      {editable && (
        <p style={{ fontSize: '12px', color: '#2563eb', marginBottom: '12px', fontWeight: 500 }}>
          Click vào răng để thay đổi tình trạng
        </p>
      )}

      <div style={{
        backgroundColor: '#fafafa', border: '1px solid #f3f4f6',
        borderRadius: '12px', padding: '20px', overflowX: 'auto',
      }}>
        {/* Upper arch */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1px', marginBottom: '6px' }}>
          <QuadrantRow teeth={UPPER_RIGHT} chart={chart} editable={editable} onToggle={handleToggle} align="right" />
          <div style={{ width: '1px', backgroundColor: '#d1d5db', margin: '0 6px', alignSelf: 'stretch' }} />
          <QuadrantRow teeth={UPPER_LEFT}  chart={chart} editable={editable} onToggle={handleToggle} align="left" />
        </div>

        {/* Center divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0', gap: '8px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
          <span style={{ fontSize: '10px', color: '#9ca3af', whiteSpace: 'nowrap', fontWeight: 500 }}>
            HÀM TRÊN ↑ ↓ HÀM DƯỚI
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }} />
        </div>

        {/* Lower arch */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1px', marginTop: '6px' }}>
          <QuadrantRow teeth={LOWER_RIGHT} chart={chart} editable={editable} onToggle={handleToggle} align="right" />
          <div style={{ width: '1px', backgroundColor: '#d1d5db', margin: '0 6px', alignSelf: 'stretch' }} />
          <QuadrantRow teeth={LOWER_LEFT}  chart={chart} editable={editable} onToggle={handleToggle} align="left" />
        </div>

        {/* Quadrant labels */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', gap: '1px' }}>
          {[
            { label: 'Góc phần tư 1', sub: '(Q1)' },
            { label: 'Góc phần tư 2', sub: '(Q2)' },
          ].map((q, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '0 4px' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>{q.label} {q.sub}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1px' }}>
          {[
            { label: 'Góc phần tư 4', sub: '(Q4)' },
            { label: 'Góc phần tư 3', sub: '(Q3)' },
          ].map((q, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '0 4px' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>{q.label} {q.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <Legend />
    </div>
  )
}
