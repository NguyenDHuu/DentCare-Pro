import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Stethoscope, RefreshCw, AlertTriangle, CheckCircle2, Search,
  Plus, Trash2, Save, PenLine,
  Activity, FileText, Armchair
} from 'lucide-react'
import { treatmentApi } from '../../api/treatment.api'
import type { TreatmentQueueItem, DentalRecord, ServiceOption, SaveDraftPayload } from '../../api/treatment.api'
import { useAuthStore } from '../../stores/auth.store'
import ToothChart from '../patients/components/ToothChart'
import type { ToothChartData } from '../../api/patients.api'

// ─── ICD-10 K00-K14 subset ────────────────────────────────────

const ICD10_DENTAL = [
  { code: 'K00.0', desc: 'Thiếu răng' },
  { code: 'K00.1', desc: 'Răng thừa' },
  { code: 'K00.2', desc: 'Dị thường kích thước và hình dạng răng' },
  { code: 'K00.6', desc: 'Rối loạn mọc răng' },
  { code: 'K01',   desc: 'Răng ngầm và răng lạc chỗ' },
  { code: 'K02.0', desc: 'Sâu răng ở men răng (giai đoạn ban đầu)' },
  { code: 'K02.1', desc: 'Sâu răng ngà' },
  { code: 'K02.2', desc: 'Sâu răng vào tủy' },
  { code: 'K02.3', desc: 'Sâu răng ngừng tiến triển' },
  { code: 'K02.9', desc: 'Sâu răng không xác định' },
  { code: 'K03.0', desc: 'Mài mòn răng do nghề nghiệp' },
  { code: 'K03.1', desc: 'Mài mòn do trám răng' },
  { code: 'K03.2', desc: 'Mòn răng' },
  { code: 'K03.3', desc: 'Tái hấp thụ chân răng' },
  { code: 'K04.0', desc: 'Viêm tủy' },
  { code: 'K04.1', desc: 'Hoại tử tủy' },
  { code: 'K04.2', desc: 'Thoái hóa tủy' },
  { code: 'K04.4', desc: 'Viêm quanh chóp cấp' },
  { code: 'K04.5', desc: 'Viêm quanh chóp mạn' },
  { code: 'K04.6', desc: 'Áp xe quanh chóp có dò' },
  { code: 'K04.7', desc: 'Áp xe quanh chóp không dò' },
  { code: 'K05.0', desc: 'Viêm lợi cấp tính' },
  { code: 'K05.1', desc: 'Viêm lợi mạn tính' },
  { code: 'K05.2', desc: 'Viêm nha chu cấp tính' },
  { code: 'K05.3', desc: 'Viêm nha chu mạn tính' },
  { code: 'K06.0', desc: 'Tụt lợi' },
  { code: 'K06.1', desc: 'Phì đại lợi' },
  { code: 'K07.2', desc: 'Sai lệch khớp cắn' },
  { code: 'K07.3', desc: 'Rối loạn khớp thái dương hàm' },
  { code: 'K08.0', desc: 'Mất răng do tai nạn' },
  { code: 'K08.1', desc: 'Mất răng do bệnh lý' },
  { code: 'K08.2', desc: 'Mất răng do nhổ' },
  { code: 'K08.3', desc: 'Chân răng còn lại' },
  { code: 'K09.0', desc: 'Nang phát triển răng' },
  { code: 'K10.2', desc: 'Viêm xương hàm' },
  { code: 'K11.2', desc: 'Sỏi tuyến nước bọt' },
  { code: 'K12.0', desc: 'Áp xe miệng tái phát' },
  { code: 'K12.1', desc: 'Loét miệng' },
  { code: 'K13.0', desc: 'Bệnh môi' },
  { code: 'K13.7', desc: 'Tổn thương niêm mạc miệng khác' },
  { code: 'K14.0', desc: 'Viêm lưỡi' },
  { code: 'K14.3', desc: 'Teo nhú lưỡi' },
]

// ─── Classification & Status meta ─────────────────────────────

const CLASS_META: Record<string, { label: string; color: string }> = {
  NEW:       { label: 'Mới',       color: '#6b7280' },
  RETURNING: { label: 'Thường',    color: '#2563eb' },
  VIP:       { label: 'VIP',       color: '#d97706' },
  SPECIAL:   { label: 'Đặc biệt',  color: '#dc2626' },
}

const STATUS_QUEUE: Record<string, { label: string; color: string }> = {
  WAITING:      { label: 'Chờ vào ghế',  color: '#d97706' },
  IN_TREATMENT: { label: 'Đang điều trị', color: '#7c3aed' },
}

const ANXIETY_LABEL: Record<string, string> = {
  LOW: 'Bình thường', MEDIUM: 'Lo lắng nhẹ', HIGH: 'Lo lắng nhiều', EXTREME: 'Rất sợ',
}

// ─── ICD10 Search ─────────────────────────────────────────────

function Icd10Picker({ value, onChange }: { value: string; onChange: (code: string, desc: string) => void }) {
  const [q, setQ] = useState(value)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = ICD10_DENTAL.filter(d =>
    d.code.toLowerCase().includes(q.toLowerCase()) ||
    d.desc.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 12)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Tìm mã ICD-10 hoặc tên bệnh..."
        style={{
          width: '100%', padding: '9px 12px', borderRadius: 8,
          border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box',
        }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 240, overflowY: 'auto',
        }}>
          {filtered.map(d => (
            <button
              key={d.code}
              onClick={() => { onChange(d.code, d.desc); setQ(`${d.code} – ${d.desc}`); setOpen(false) }}
              style={{
                display: 'flex', width: '100%', textAlign: 'left', padding: '8px 12px',
                background: 'none', border: 'none', cursor: 'pointer', gap: 8, alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#2563eb', minWidth: 52 }}>
                {d.code}
              </span>
              <span style={{ fontSize: 13, color: '#374151' }}>{d.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Service row ──────────────────────────────────────────────

interface ServiceRowData {
  _key:        string
  serviceId:   number
  serviceName: string
  toothNumber: string
  unitPrice:   number
  quantity:    number
  note:        string
}

function ServiceRow({
  row, options, onChange, onRemove,
}: {
  row:      ServiceRowData
  options:  ServiceOption[]
  onChange: (updated: ServiceRowData) => void
  onRemove: () => void
}) {
  const selected = options.find(o => o.id === row.serviceId)

  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      {/* Service picker */}
      <td style={{ padding: '8px 10px' }}>
        <select
          value={row.serviceId || ''}
          onChange={e => {
            const svc = options.find(o => o.id === Number(e.target.value))
            if (svc) onChange({ ...row, serviceId: svc.id, serviceName: svc.name, unitPrice: svc.unitPrice })
          }}
          style={{
            width: '100%', padding: '6px 8px', borderRadius: 6,
            border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
          }}
        >
          <option value="">— Chọn dịch vụ —</option>
          {options.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </td>
      {/* Tooth */}
      <td style={{ padding: '8px 10px' }}>
        <input
          value={row.toothNumber}
          onChange={e => onChange({ ...row, toothNumber: e.target.value })}
          placeholder="Răng 46..."
          style={{
            width: '100%', padding: '6px 8px', borderRadius: 6,
            border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
          }}
        />
      </td>
      {/* Price */}
      <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#1f2937', whiteSpace: 'nowrap' }}>
        {(row.unitPrice * row.quantity).toLocaleString('vi-VN')}đ
      </td>
      {/* Remove */}
      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  )
}

// ─── Patient queue card ───────────────────────────────────────

function QueueCard({
  item, selected, onClick,
}: {
  item:     TreatmentQueueItem
  selected: boolean
  onClick:  () => void
}) {
  const cls = CLASS_META[item.patient.classification]
  const st  = STATUS_QUEUE[item.status] ?? { label: item.status, color: '#6b7280' }
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 6,
        borderRadius: 10, border: selected ? '2px solid #6366f1' : '1px solid #e5e7eb',
        background: selected ? '#f0f0ff' : '#fff', cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', background: '#6366f1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0,
          }}>
            {item.patient.fullName.charAt(0)}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>{item.patient.fullName}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>
              {item.code} · {cls ? <span style={{ color: cls.color, fontWeight: 700 }}>{cls.label}</span> : ''}
            </div>
          </div>
        </div>
        {item.dentalRecord?.status === 'SIGNED' && (
          <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
        )}
      </div>
      {item.patient.allergies && (
        <div style={{
          marginTop: 6, fontSize: 11, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4,
          background: '#fff1f2', borderRadius: 6, padding: '3px 6px',
        }}>
          <AlertTriangle size={11} /> Dị ứng: {item.patient.allergies}
        </div>
      )}
      <div style={{ marginTop: 4, fontSize: 11, color: st.color, fontWeight: 600 }}>{st.label}</div>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────

// Classification sort weight for client-side display
const CLASS_ORDER: Record<string, number> = { VIP: 1, PRIORITY: 2, REGULAR: 3, NEW: 4 }

export default function TreatmentPage() {
  const { user, activeRole } = useAuthStore()

  const [queue,      setQueue]      = useState<TreatmentQueueItem[]>([])
  const [services,   setServices]   = useState<ServiceOption[]>([])
  const [selected,   setSelected]   = useState<TreatmentQueueItem | null>(null)
  const [record,     setRecord]     = useState<DentalRecord | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [signing,    setSigning]    = useState(false)
  const [qSearch,    setQSearch]    = useState('')
  const [lastSaved,  setLastSaved]  = useState<Date | null>(null)

  // Form state
  const [visitReason,      setVisitReason]      = useState('')
  const [symptoms,         setSymptoms]         = useState('')
  const [icd10Code,        setIcd10Code]        = useState('')
  const [icd10Description, setIcd10Description] = useState('')
  const [clinicalNotes,    setClinicalNotes]    = useState('')
  const [aftercareNotes,   setAftercareNotes]   = useState('')
  const [followUpDate,     setFollowUpDate]     = useState('')
  const [toothChart,       setToothChart]       = useState<ToothChartData | null>(null)
  const [serviceRows,      setServiceRows]      = useState<ServiceRowData[]>([])
  const [editingChart,     setEditingChart]     = useState(false)

  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load queue & services ──────────────────────────────────
  const fetchQueue = useCallback(async () => {
    try {
      // Bác sĩ chỉ xem danh sách bệnh nhân của mình; admin/receptionist xem tất cả
      const doctorId = activeRole === 'DOCTOR' ? user?.id : undefined
      const [q, s] = await Promise.all([
        treatmentApi.getQueue(doctorId),
        treatmentApi.getServices(),
      ])
      // Client-side sort: IN_TREATMENT lên đầu → phân loại → thứ tự đến
      const sorted = [...q].sort((a, b) => {
        const sA = a.status === 'IN_TREATMENT' ? 0 : 1
        const sB = b.status === 'IN_TREATMENT' ? 0 : 1
        if (sA !== sB) return sA - sB
        const cA = CLASS_ORDER[a.patient.classification] ?? 5
        const cB = CLASS_ORDER[b.patient.classification] ?? 5
        if (cA !== cB) return cA - cB
        return new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime()
      })
      setQueue(sorted)
      setServices(s)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [user?.id, activeRole])

  useEffect(() => { fetchQueue() }, [fetchQueue])

  // ── Select patient → load record ──────────────────────────
  const handleSelectPatient = async (item: TreatmentQueueItem) => {
    setSelected(item)
    setRecord(null)
    try {
      const rec = await treatmentApi.getOrCreate(item.id)
      setRecord(rec)
      // Populate form
      setVisitReason(rec.visitReason ?? '')
      setSymptoms(rec.symptoms ?? '')
      setIcd10Code(rec.icd10Code ?? '')
      setIcd10Description(rec.icd10Description ?? '')
      setClinicalNotes(rec.clinicalNotes ?? '')
      setAftercareNotes(rec.aftercareNotes ?? '')
      setFollowUpDate(rec.followUpDate ? rec.followUpDate.slice(0, 10) : '')
      setToothChart(item.patient.toothChart ?? null)
      setServiceRows(rec.services.map(s => ({
        _key:        `${s.id}`,
        serviceId:   s.serviceId,
        serviceName: s.service.name,
        toothNumber: s.toothNumber ?? '',
        unitPrice:   s.unitPrice,
        quantity:    s.quantity,
        note:        s.note ?? '',
      })))
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Lỗi tải hồ sơ')
    }
  }

  // ── Build save payload ─────────────────────────────────────
  const buildPayload = (): SaveDraftPayload => ({
    visitReason:      visitReason  || undefined,
    symptoms:         symptoms     || undefined,
    icd10Code:        icd10Code    || undefined,
    icd10Description: icd10Description || undefined,
    clinicalNotes:    clinicalNotes    || undefined,
    aftercareNotes:   aftercareNotes   || undefined,
    followUpDate:     followUpDate || null,
    toothChart:       toothChart,
    services:         serviceRows.filter(r => r.serviceId).map(r => ({
      serviceId:   r.serviceId,
      toothNumber: r.toothNumber,
      unitPrice:   r.unitPrice,
      quantity:    r.quantity,
      note:        r.note || undefined,
    })),
  })

  // ── Manual save draft ──────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!record) return
    setSaving(true)
    try {
      const updated = await treatmentApi.saveDraft(record.id, buildPayload())
      setRecord(updated)
      setLastSaved(new Date())
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Lỗi lưu nháp')
    } finally { setSaving(false) }
  }

  // ── Auto-save every 60s ────────────────────────────────────
  useEffect(() => {
    if (!record || record.status === 'SIGNED') return
    if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    autoSaveRef.current = setInterval(async () => {
      if (!record) return
      try {
        await treatmentApi.saveDraft(record.id, buildPayload())
        setLastSaved(new Date())
      } catch { /* silent */ }
    }, 60_000)
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current) }
  }, [record, visitReason, symptoms, icd10Code, clinicalNotes, serviceRows, toothChart])

  // ── Sign record ────────────────────────────────────────────
  const handleSign = async () => {
    if (!record) return
    if (!icd10Code) { alert('Vui lòng nhập chẩn đoán ICD-10 trước khi ký số'); return }
    if (!confirm('Xác nhận ký số & chốt hồ sơ? Sau khi ký không thể chỉnh sửa.')) return
    setSigning(true)
    try {
      // Save latest data first
      await treatmentApi.saveDraft(record.id, buildPayload())
      const signed = await treatmentApi.signRecord(record.id)
      setRecord(signed)
      fetchQueue()
      alert(`✅ Đã ký số hồ sơ ${signed.code}`)
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Lỗi ký số')
    } finally { setSigning(false) }
  }

  // ── Add service row ────────────────────────────────────────
  const addServiceRow = () => {
    setServiceRows(prev => [...prev, {
      _key:        Date.now().toString(),
      serviceId:   0,
      serviceName: '',
      toothNumber: '',
      unitPrice:   0,
      quantity:    1,
      note:        '',
    }])
  }

  const totalAmount = serviceRows
    .filter(r => r.serviceId)
    .reduce((sum, r) => sum + r.unitPrice * r.quantity, 0)

  const isSigned = record?.status === 'SIGNED'

  const filteredQueue = queue.filter(q =>
    !qSearch ||
    q.patient.fullName.toLowerCase().includes(qSearch.toLowerCase()) ||
    q.patient.phone.includes(qSearch) ||
    q.code.toLowerCase().includes(qSearch.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

      {/* ── Left: Patient queue ── */}
      <div style={{
        width: 260, flexShrink: 0, borderRight: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column', background: '#fafafa',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1f2937', margin: 0 }}>Đang điều trị</h2>
            <button
              onClick={fetchQueue}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              value={qSearch}
              onChange={e => setQSearch(e.target.value)}
              placeholder="Tìm bệnh nhân đang chờ..."
              style={{
                width: '100%', paddingLeft: 26, paddingRight: 8, paddingTop: 7, paddingBottom: 7,
                borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, outline: 'none',
                boxSizing: 'border-box', background: '#fff',
              }}
            />
          </div>
        </div>

        {/* Queue list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 12 }}>Đang tải...</div>
          ) : filteredQueue.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>
              <Armchair size={32} style={{ opacity: 0.3, marginBottom: 6 }} />
              <div style={{ fontSize: 12 }}>Không có bệnh nhân</div>
            </div>
          ) : filteredQueue.map(item => (
            <QueueCard
              key={item.id}
              item={item}
              selected={selected?.id === item.id}
              onClick={() => handleSelectPatient(item)}
            />
          ))}
        </div>
      </div>

      {/* ── Right: Treatment form ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc' }}>
        {!selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
            <Stethoscope size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>Chọn bệnh nhân để bắt đầu khám</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Chọn bệnh nhân từ danh sách bên trái</div>
          </div>
        ) : (
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 24px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1f2937', margin: 0 }}>
                  Khám &amp; Điều trị nha khoa
                </h1>
                <p style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>
                  Cập nhật sơ đồ răng, chẩn đoán và chỉ định dịch vụ cho bệnh nhân.
                </p>
              </div>
              {lastSaved && !isSigned && (
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  Đã lưu {lastSaved.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* Allergy banner */}
            {selected.patient.allergies && (
              <div style={{
                background: '#fff1f2', border: '1px solid #fca5a5', borderLeft: '4px solid #dc2626',
                borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#991b1b' }}>Cảnh báo dị ứng: </span>
                  <span style={{ fontSize: 13, color: '#7f1d1d' }}>{selected.patient.allergies}</span>
                </div>
              </div>
            )}

            {/* Systemic disease warning */}
            {selected.patient.systemicDiseases && (
              <div style={{
                background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '4px solid #d97706',
                borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Activity size={16} style={{ color: '#d97706', flexShrink: 0 }} />
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>Bệnh nền: </span>
                  <span style={{ fontSize: 13, color: '#78350f' }}>{selected.patient.systemicDiseases}</span>
                </div>
              </div>
            )}

            {/* Signed banner */}
            {isSigned && (
              <div style={{
                background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 10,
                padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <CheckCircle2 size={18} style={{ color: '#059669' }} />
                <span style={{ fontWeight: 700, color: '#065f46' }}>
                  Hồ sơ đã được ký số — {record?.code}
                </span>
              </div>
            )}

            {/* ── Section 1: Bệnh án & Chẩn đoán ── */}
            <Section icon={<Activity size={16} />} title="Bệnh án &amp; Chẩn đoán">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <Label>Lý do đến khám</Label>
                  <textarea
                    value={visitReason}
                    onChange={e => setVisitReason(e.target.value)}
                    disabled={isSigned}
                    rows={3}
                    placeholder="Mô tả lý do bệnh nhân đến khám..."
                    style={textAreaStyle(isSigned)}
                  />
                </div>
                <div>
                  <Label>Chẩn đoán (Mã ICD-10) <span style={{ color: '#dc2626' }}>*</span></Label>
                  {isSigned ? (
                    <div style={{ padding: '9px 12px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}>
                      <strong>{icd10Code}</strong> – {icd10Description}
                    </div>
                  ) : (
                    <Icd10Picker
                      value={icd10Code ? `${icd10Code} – ${icd10Description}` : ''}
                      onChange={(code, desc) => { setIcd10Code(code); setIcd10Description(desc) }}
                    />
                  )}
                  {selected.patient.systemicDiseases && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#92400e', background: '#fffbeb', padding: '4px 8px', borderRadius: 6 }}>
                      <strong>Ghi chú y tế:</strong> {selected.patient.systemicDiseases}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <Label>Triệu chứng lâm sàng</Label>
                <textarea
                  value={symptoms}
                  onChange={e => setSymptoms(e.target.value)}
                  disabled={isSigned}
                  rows={2}
                  placeholder="Mô tả triệu chứng bệnh nhân khai..."
                  style={textAreaStyle(isSigned)}
                />
              </div>
            </Section>

            {/* ── Section 2: Sơ đồ răng FDI ── */}
            <Section
              icon={<FileText size={16} />}
              title="Sơ đồ răng (FDI)"
              action={
                !isSigned ? (
                  <button
                    onClick={() => setEditingChart(p => !p)}
                    style={{
                      fontSize: 12, color: '#6366f1', background: 'none', border: 'none',
                      cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    {editingChart ? 'Xem sơ đồ' : 'Chỉnh sửa sơ đồ'}
                  </button>
                ) : undefined
              }
            >
              <ToothChart
                chart={toothChart ?? {}}
                onChange={isSigned ? undefined : (val) => setToothChart(val)}
                editable={editingChart && !isSigned}
              />
            </Section>

            {/* ── Section 3: Chỉ định dịch vụ ── */}
            <Section icon={<Stethoscope size={16} />} title="Chỉ định dịch vụ">
              {serviceRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '12px', color: '#9ca3af', fontSize: 13 }}>
                  Chưa có dịch vụ nào. {!isSigned && 'Nhấn "+ Thêm dịch vụ" để thêm.'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={thStyle}>TÊN DỊCH VỤ</th>
                      <th style={thStyle}>RĂNG/HÀM</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>ĐƠN GIÁ (VND)</th>
                      <th style={{ ...thStyle, width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceRows.map((row, i) => (
                      <ServiceRow
                        key={row._key}
                        row={row}
                        options={services}
                        onChange={updated => setServiceRows(prev => prev.map((r, idx) => idx === i ? updated : r))}
                        onRemove={() => setServiceRows(prev => prev.filter((_, idx) => idx !== i))}
                      />
                    ))}
                  </tbody>
                </table>
              )}

              {!isSigned && (
                <button
                  onClick={addServiceRow}
                  style={{
                    width: '100%', padding: '9px', borderRadius: 8, border: '1.5px dashed #d1d5db',
                    background: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <Plus size={14} /> Thêm dịch vụ
                </button>
              )}

              {totalAmount > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'flex-end', marginTop: 12,
                  paddingTop: 12, borderTop: '1px solid #f3f4f6',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>
                    Tổng cộng: <span style={{ color: '#6366f1' }}>{totalAmount.toLocaleString('vi-VN')}đ</span>
                  </span>
                </div>
              )}
            </Section>

            {/* ── Section 4: Ghi chú & Hướng dẫn ── */}
            <Section icon={<FileText size={16} />} title="Ghi chú lâm sàng &amp; Hướng dẫn">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <Label>Ghi chú lâm sàng</Label>
                  <textarea
                    value={clinicalNotes}
                    onChange={e => setClinicalNotes(e.target.value)}
                    disabled={isSigned}
                    rows={3}
                    placeholder="Ghi chú quá trình thăm khám..."
                    style={textAreaStyle(isSigned)}
                  />
                </div>
                <div>
                  <Label>Hướng dẫn chăm sóc sau điều trị</Label>
                  <textarea
                    value={aftercareNotes}
                    onChange={e => setAftercareNotes(e.target.value)}
                    disabled={isSigned}
                    rows={3}
                    placeholder="Hướng dẫn bệnh nhân sau điều trị..."
                    style={textAreaStyle(isSigned)}
                  />
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <Label>Lịch tái khám</Label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  disabled={isSigned}
                  style={{
                    padding: '9px 12px', borderRadius: 8, border: '1.5px solid #d1d5db',
                    fontSize: 13, outline: 'none', opacity: isSigned ? 0.6 : 1,
                  }}
                />
              </div>
            </Section>

            {/* ── Action buttons ── */}
            {!isSigned && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 32 }}>
                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 20px', borderRadius: 8, border: '1.5px solid #d1d5db',
                    background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Save size={15} />
                  {saving ? 'Đang lưu...' : 'Lưu nháp'}
                </button>

                <button
                  onClick={handleSign}
                  disabled={signing || !icd10Code}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 22px', borderRadius: 8, border: 'none',
                    background: signing || !icd10Code ? '#a5b4fc' : '#6366f1',
                    color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: signing || !icd10Code ? 'not-allowed' : 'pointer',
                  }}
                >
                  <PenLine size={15} />
                  {signing ? 'Đang xử lý...' : 'Ký số & Chốt hồ sơ'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────

function Section({ icon, title, children, action }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
      padding: '18px 20px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon}
          <span dangerouslySetInnerHTML={{ __html: title }} />
        </h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {children}
    </label>
  )
}

const textAreaStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none',
  resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
  opacity: disabled ? 0.7 : 1, background: disabled ? '#f9fafb' : '#fff',
})

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em',
}
