import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, ChevronRight, CheckCircle2, Loader2,
  User, CalendarDays, X, CalendarPlus, ChevronLeft,
} from 'lucide-react'
import {
  receptionistApi,
  type BookingService, type BookingDoctor,
  type TimelineDay, type TimelineShift,
  type CreatedAppointment,
} from '../../api/receptionist.api'

// ─── Helpers ──────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: 'white', borderRadius: '14px',
  border: '1px solid #e5e7eb', padding: '20px 24px',
}
const inputCss: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
  borderRadius: '8px', fontSize: '14px', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', backgroundColor: 'white',
}

function getWeekMonday(date: Date): Date {
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const dow = d.getDay()
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return d
}
/** Local-timezone date string — avoids UTC offset shifting the date */
function toDateStr(d: Date): string {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// ─── Step indicator ───────────────────────────────────────────

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Thông tin bệnh nhân' },
    { n: 2, label: 'Chọn dịch vụ' },
    { n: 3, label: 'Chọn bác sĩ & giờ khám' },
  ]
  return (
    <div style={{ ...card, padding: '18px 28px', marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700,
              backgroundColor: step > s.n ? '#22c55e' : step === s.n ? '#2563eb' : '#f3f4f6',
              color: step > s.n ? 'white' : step === s.n ? 'white' : '#9ca3af',
            }}>
              {step > s.n ? <CheckCircle2 size={16} /> : s.n}
            </div>
            <span style={{ fontSize: '13px', fontWeight: step === s.n ? 700 : 500, whiteSpace: 'nowrap',
              color: step === s.n ? '#2563eb' : step > s.n ? '#16a34a' : '#9ca3af' }}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: '2px', margin: '0 16px', backgroundColor: step > s.n ? '#22c55e' : '#e5e7eb' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step 1: Patient info ─────────────────────────────────────

interface PatientForm { phone: string; name: string; dob: string; gender: string; note: string }

function Step1({ form, onChange, onNext }: {
  form: PatientForm; onChange: (f: Partial<PatientForm>) => void; onNext: () => void
}) {
  const [looking, setLooking] = useState(false)
  const [looked,  setLooked]  = useState(false)

  const [phoneTouched, setPhoneTouched] = useState(false)
  const [nameTouched,  setNameTouched]  = useState(false)

  const phoneDigits   = form.phone.replace(/\D/g, '')
  const phoneValid    = phoneDigits.length >= 7
  const nameValid     = form.name.trim().length > 0
  const valid         = phoneValid && nameValid

  const lookup = async () => {
    if (!phoneValid) return
    setLooking(true)
    try {
      const res = await receptionistApi.lookupPatient(form.phone)
      if (res.data) {
        onChange({ name: res.data.patientName, dob: res.data.patientDob ? res.data.patientDob.slice(0, 10) : '', gender: res.data.patientGender ?? '' })
        setLooked(true)
      }
    } catch { /* silent */ }
    finally { setLooking(false) }
  }

  return (
    <div style={card}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 20px' }}>Thông tin bệnh nhân</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Phone */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Số điện thoại <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <input type="tel" value={form.phone} placeholder="0901234567"
              onChange={e => { onChange({ phone: e.target.value }); setLooked(false) }}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              onBlur={() => setPhoneTouched(true)}
              style={{ ...inputCss, paddingRight: '40px', borderColor: phoneTouched && !phoneValid ? '#ef4444' : '#e5e7eb' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
            />
            <button onClick={lookup} disabled={looking || !phoneValid} title="Tìm bệnh nhân cũ"
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: phoneValid ? 'pointer' : 'default', color: phoneValid ? '#2563eb' : '#d1d5db', padding: '2px' }}>
              {looking ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
            </button>
          </div>
          {phoneTouched && !phoneValid && (
            <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>Vui lòng nhập ít nhất 7 chữ số</p>
          )}
          {looked && (
            <p style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={11} /> Tìm thấy bệnh nhân cũ — đã điền sẵn
            </p>
          )}
        </div>
        {/* Name */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Họ tên <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input type="text" value={form.name} placeholder="Nguyễn Văn A"
            onChange={e => onChange({ name: e.target.value })}
            onBlur={() => setNameTouched(true)}
            style={{ ...inputCss, borderColor: nameTouched && !nameValid ? '#ef4444' : '#e5e7eb' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
          />
          {nameTouched && !nameValid && (
            <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>Vui lòng nhập họ tên bệnh nhân</p>
          )}
        </div>
        {/* DOB */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Ngày sinh</label>
          <input type="date" value={form.dob} onChange={e => onChange({ dob: e.target.value })}
            style={inputCss}
            onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
            onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
          />
        </div>
        {/* Gender */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Giới tính</label>
          <select value={form.gender} onChange={e => onChange({ gender: e.target.value })}
            style={{ ...inputCss, appearance: 'none', cursor: 'pointer' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
            onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
          >
            <option value="">Chọn giới tính</option>
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </select>
        </div>
        {/* Note */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Ghi chú</label>
          <textarea value={form.note} rows={3} placeholder="Ghi chú về tình trạng bệnh nhân..."
            onChange={e => onChange({ note: e.target.value })}
            style={{ ...inputCss, resize: 'vertical' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
            onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
        {/* Validation hint */}
        {!valid && (phoneTouched || nameTouched) && (
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
            {!phoneValid ? '⚠ Số điện thoại cần ít nhất 7 chữ số' : '⚠ Vui lòng nhập họ tên bệnh nhân'}
          </p>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => { setPhoneTouched(true); setNameTouched(true); if (valid) onNext() }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: valid ? 'pointer' : 'not-allowed', backgroundColor: valid ? '#2563eb' : '#e5e7eb', color: valid ? 'white' : '#9ca3af', transition: 'background .15s' }}>
            Tiếp tục <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Service ──────────────────────────────────────────

function Step2({ services, selectedService, anyDoctor, onSelectService, onToggleDoctor, onNext, onBack, loading }: {
  services: BookingService[]; selectedService: number | null; anyDoctor: boolean
  onSelectService: (id: number) => void; onToggleDoctor: (v: boolean) => void
  onNext: () => void; onBack: () => void; loading: boolean
}) {
  return (
    <div style={card}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Chọn dịch vụ</h3>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 14px' }}>Khách hàng có yêu cầu bác sĩ cụ thể?</p>
      <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
        {[
          { v: true,  label: 'Bác sĩ bất kỳ (ưu tiên lịch trống gần nhất)' },
          { v: false, label: 'Chọn bác sĩ cụ thể' },
        ].map(opt => (
          <label key={String(opt.v)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
            <input type="radio" checked={anyDoctor === opt.v} onChange={() => onToggleDoctor(opt.v)}
              style={{ accentColor: '#2563eb', width: '15px', height: '15px' }} />
            {opt.label}
          </label>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Loader2 size={24} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : services.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '13px' }}>Chưa có dịch vụ nào đang hoạt động</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {services.map(svc => (
            <label key={svc.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '10px', cursor: 'pointer', border: `1.5px solid ${selectedService === svc.id ? '#2563eb' : '#e5e7eb'}`, backgroundColor: selectedService === svc.id ? '#eff6ff' : 'white', transition: 'border-color .15s' }}>
              <input type="radio" checked={selectedService === svc.id} onChange={() => onSelectService(svc.id)}
                style={{ accentColor: '#2563eb', width: '16px', height: '16px', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{svc.name}</p>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>
                  Mã: {svc.code}{svc.duration > 0 ? ` • ${svc.duration} phút` : ''}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ padding: '10px 22px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#374151' }}>Quay lại</button>
        <button onClick={onNext} disabled={!selectedService}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: selectedService ? 'pointer' : 'not-allowed', backgroundColor: selectedService ? '#2563eb' : '#e5e7eb', color: selectedService ? 'white' : '#9ca3af' }}>
          Tiếp tục <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Availability dot colors ──────────────────────────────────

const AVAIL = {
  FREE:        { dot: '#22c55e', label: 'Còn trống',    bg: '#f0fdf4', border: '#bbf7d0' },
  BUSY:        { dot: '#eab308', label: 'Còn ít chỗ',   bg: '#fefce8', border: '#fef08a' },
  FULL:        { dot: '#ef4444', label: 'Kín lịch',     bg: '#fef2f2', border: '#fca5a5' },
  UNSCHEDULED: { dot: '#3b82f6', label: 'Có thể đặt',   bg: '#eff6ff', border: '#bfdbfe' },
}

const SHIFT_COLORS: Record<string, string> = {
  blue:   '#3b82f6', green:  '#22c55e', purple: '#a855f7',
  orange: '#f97316', red:    '#ef4444', teal:   '#14b8a6', pink: '#ec4899',
}

// ─── Weekly timeline for a doctor ────────────────────────────

function WeekTimeline({
  weekDays, selectedDate, selectedShiftId, selectedSlot,
  onSelectSlot,
  anyDoctor,
}: {
  weekDays: TimelineDay[]
  selectedDate: string | null
  selectedShiftId: number | null
  selectedSlot: string | null
  onSelectSlot: (date: string, shift: TimelineShift, time: string) => void
  anyDoctor: boolean
}) {
  // Auto-open: use selectedDate if set, otherwise open first non-past day with available slots
  const autoOpenDay = selectedDate ?? weekDays.find(d => {
    if (d.isPast) return false
    return d.shifts.some(s => s.freeCount > 0) || d.unscheduledShifts.length > 0
  })?.date ?? null

  const [openDay, setOpenDay] = useState<string | null>(autoOpenDay)

  // When week changes (weekDays updates), re-compute auto-open
  useEffect(() => {
    if (selectedDate) {
      setOpenDay(selectedDate)
    } else {
      const first = weekDays.find(d => {
        if (d.isPast) return false
        return d.shifts.some(s => s.freeCount > 0) || d.unscheduledShifts.length > 0
      })?.date ?? null
      setOpenDay(first)
    }
  }, [weekDays, selectedDate])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* 7-day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
        {weekDays.map(day => {
          const allShifts = [...day.shifts, ...day.unscheduledShifts]
          const isOpen    = openDay === day.date
          const hasFree   = day.totalFree > 0 || day.unscheduledShifts.length > 0
          const isSelected = selectedDate === day.date

          return (
            <div key={day.date}>
              {/* Day header */}
              <button
                onClick={() => !day.isPast && setOpenDay(isOpen ? null : day.date)}
                disabled={day.isPast || allShifts.length === 0}
                style={{
                  width: '100%', padding: '10px 6px', borderRadius: '10px', cursor: (day.isPast || allShifts.length === 0) ? 'default' : 'pointer', border: 'none', textAlign: 'center',
                  backgroundColor: isSelected ? '#eff6ff' : isOpen ? '#f8fafc' : day.isPast ? '#f9fafb' : 'white',
                  outline: isSelected ? '2px solid #2563eb' : 'none',
                  opacity: day.isPast ? 0.45 : 1,
                  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                  transition: 'background .15s',
                }}
              >
                <p style={{ fontSize: '11px', fontWeight: 700, color: day.isToday ? '#2563eb' : '#6b7280', margin: '0 0 2px', textTransform: 'uppercase' }}>{day.dayLabel}</p>
                <p style={{ fontSize: '13px', fontWeight: 700, color: day.isToday ? '#2563eb' : '#111827', margin: '0 0 6px' }}>{day.displayDate}</p>

                {allShifts.length === 0 ? (
                  <p style={{ fontSize: '10px', color: '#d1d5db', margin: 0 }}>—</p>
                ) : day.unscheduledShifts.length > 0 && day.shifts.length === 0 ? (
                  // No schedule → can book any shift
                  <div>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', margin: '0 auto 4px' }} />
                    <p style={{ fontSize: '9px', color: '#3b82f6', margin: 0, fontWeight: 600 }}>Tự do</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {day.shifts.map(sh => {
                      const dotColor = sh.status === 'FULL' ? '#ef4444' : sh.status === 'BUSY' ? '#eab308' : '#22c55e'
                      return (
                        <div key={sh.shiftId} style={{ padding: '2px 4px', borderRadius: '4px', backgroundColor: sh.status === 'FULL' ? '#fef2f2' : sh.status === 'BUSY' ? '#fefce8' : '#f0fdf4' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
                            <span style={{ fontSize: '9px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '50px' }}>{sh.name}</span>
                          </div>
                          <p style={{ fontSize: '9px', color: '#9ca3af', margin: '1px 0 0', textAlign: 'center' }}>{sh.freeCount > 0 ? `còn ${sh.freeCount}` : 'kín'}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Slot picker for open day */}
      {openDay && (() => {
        const day = weekDays.find(d => d.date === openDay)
        if (!day) return null
        const allShifts = day.shifts.length > 0 ? day.shifts : day.unscheduledShifts

        return (
          <div style={{ ...card, padding: '16px 20px', backgroundColor: '#f8fafc' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CalendarDays size={15} color="#2563eb" />
              {day.dayLabel} {day.displayDate}
              {day.unscheduledShifts.length > 0 && day.shifts.length === 0 && (
                <span style={{ fontSize: '10px', backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '99px', fontWeight: 600 }}>
                  Chưa phân lịch — bác sĩ sẽ được tự phân công sau khi đặt
                </span>
              )}
            </p>

            {allShifts.map(sh => (
              <div key={sh.shiftId} style={{ marginBottom: '16px' }}>
                {/* Shift label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: SHIFT_COLORS[sh.colorCode] || '#6b7280', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                    {sh.name} &nbsp;{sh.startTime}–{sh.endTime}
                  </span>
                  <span style={{ fontSize: '11px', color: sh.status === 'FULL' ? '#ef4444' : sh.isUnscheduled ? '#3b82f6' : '#16a34a', fontWeight: 600 }}>
                    {sh.isUnscheduled ? `${sh.maxPatients} slot` : sh.status === 'FULL' ? 'Đầy' : `còn ${sh.freeCount}`}
                  </span>
                </div>

                {sh.status === 'FULL' ? (
                  <p style={{ fontSize: '12px', color: '#ef4444', margin: 0 }}>Ca này đã kín lịch</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {sh.slots.map(slot => {
                      // Slot được chọn: phải khớp đúng ngày + ca + giờ
                      const isThisSlotSelected =
                        selectedDate === openDay &&
                        selectedShiftId === sh.shiftId &&
                        selectedSlot === slot.time
                      return (
                        <button
                          key={slot.time}
                          onClick={() => slot.available && onSelectSlot(openDay!, sh, slot.time)}
                          disabled={!slot.available}
                          title={slot.patientName ? `Đã đặt: ${slot.patientName}` : `Chọn ${slot.time}`}
                          style={{
                            minWidth: '68px', padding: '7px 8px', borderRadius: '8px', textAlign: 'center',
                            border: `1.5px solid ${
                              !slot.available      ? '#e5e7eb'
                              : isThisSlotSelected ? '#2563eb'
                              : '#d1fae5'
                            }`,
                            backgroundColor: !slot.available      ? '#f9fafb'
                                           : isThisSlotSelected ? '#dbeafe'
                                           : '#f0fdf4',
                            cursor: slot.available ? 'pointer' : 'not-allowed',
                            opacity: !slot.available ? 0.5 : 1,
                            transform: isThisSlotSelected ? 'scale(1.04)' : 'none',
                            transition: 'all 0.12s',
                          }}
                        >
                          <p style={{ fontSize: '12px', fontWeight: isThisSlotSelected ? 800 : 700, margin: 0, color: !slot.available ? '#9ca3af' : isThisSlotSelected ? '#1d4ed8' : '#111827' }}>{slot.time}</p>
                          {isThisSlotSelected && <p style={{ fontSize: '9px', margin: '2px 0 0', color: '#2563eb', fontWeight: 700 }}>✓</p>}
                          {slot.patientName && <p style={{ fontSize: '9px', margin: '1px 0 0', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '64px' }}>{slot.patientName}</p>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

// ─── Step 3: Doctor + timeline ────────────────────────────────

function Step3({
  doctors, serviceName, anyDoctor,
  selectedDoctor, onSelectDoctor,
  weekStart, onChangeWeek,
  timeline, timelineLoading,
  selectedSlot, selectedShiftId, selectedDate,
  onSelectSlot,
  onConfirm, onBack, saving, doctorsLoading,
}: {
  doctors:        BookingDoctor[]
  serviceName:    string
  anyDoctor:      boolean
  selectedDoctor: number | null
  onSelectDoctor: (id: number) => void
  weekStart:      string   // YYYY-MM-DD (Monday)
  onChangeWeek:   (ws: string) => void
  timeline:       TimelineDay[]
  timelineLoading: boolean
  selectedSlot:    string | null   // "HH:MM"
  selectedShiftId: number | null
  selectedDate:    string | null   // "YYYY-MM-DD"
  onSelectSlot:    (date: string, shift: TimelineShift, time: string) => void
  onConfirm:  () => void
  onBack:     () => void
  saving:     boolean
  doctorsLoading: boolean
}) {
  const today       = toDateStr(new Date())
  const mon         = getWeekMonday(new Date(weekStart))
  const sun         = addDays(mon, 6)
  const currentMon  = toDateStr(getWeekMonday(new Date()))
  const isThisWeek  = weekStart === currentMon
  const canConfirm  = !!selectedDoctor && !!selectedSlot && !!selectedDate

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Week navigation */}
      <div style={{ ...card, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => onChangeWeek(toDateStr(addDays(mon, -7)))}
          disabled={isThisWeek}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '7px', border: '1.5px solid #e5e7eb', background: isThisWeek ? '#f9fafb' : 'white', cursor: isThisWeek ? 'not-allowed' : 'pointer', fontSize: '13px', color: isThisWeek ? '#d1d5db' : '#374151', fontWeight: 500 }}>
          <ChevronLeft size={14} /> Tuần trước
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>
            {isThisWeek ? '📅 Tuần này' : '📅 Tuần sau'}
          </p>
          <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
            T2 {mon.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – CN {sun.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
          </p>
        </div>
        <button
          onClick={() => onChangeWeek(toDateStr(addDays(mon, 7)))}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '7px', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#374151', fontWeight: 500 }}>
          Tuần sau <ChevronRight size={14} />
        </button>
      </div>

      {/* Doctor list */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>
            {anyDoctor ? '🔍 Hệ thống chọn bác sĩ tối ưu' : '👤 Chọn bác sĩ'} — {serviceName}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            {Object.entries(AVAIL).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: v.dot }} />
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{v.label}</span>
              </div>
            ))}
          </div>
        </div>

        {doctorsLoading ? (
          <div style={{ textAlign: 'center', padding: '28px' }}>
            <Loader2 size={22} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : doctors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px', color: '#9ca3af', fontSize: '13px' }}>
            Không có bác sĩ nào có lịch trong tuần này. Thử chuyển sang tuần sau.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {doctors.map((doc, idx) => {
              const av   = AVAIL[doc.availability] ?? AVAIL.FULL
              const isSel = selectedDoctor === doc.id
              const isRecommended = anyDoctor && idx === 0 && doc.availability !== 'FULL'

              return (
                <button key={doc.id}
                  onClick={() => doc.availability !== 'FULL' && onSelectDoctor(doc.id)}
                  disabled={doc.availability === 'FULL'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
                    borderRadius: '10px', cursor: doc.availability === 'FULL' ? 'not-allowed' : 'pointer',
                    border: `2px solid ${isSel ? '#2563eb' : '#e5e7eb'}`,
                    backgroundColor: isSel ? '#eff6ff' : 'white',
                    opacity: doc.availability === 'FULL' ? 0.55 : 1,
                    textAlign: 'left', transition: 'border-color .15s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={20} color="#2563eb" />
                    </div>
                    {/* Dot */}
                    <div style={{ position: 'absolute', bottom: '1px', right: '1px', width: '11px', height: '11px', borderRadius: '50%', backgroundColor: av.dot, border: '2px solid white' }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>BS. {doc.name}</p>
                      {isRecommended && (
                        <span style={{ fontSize: '10px', backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '2px 7px', borderRadius: '99px', fontWeight: 700 }}>Đề xuất</span>
                      )}
                    </div>

                    {doc.availability === 'UNSCHEDULED' ? (
                      <>
                        <p style={{ fontSize: '12px', color: '#3b82f6', margin: '2px 0 0', fontWeight: 600 }}>
                          Chưa có lịch trực tuần này — có thể đặt bất kỳ ca
                        </p>
                        <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>
                          Lịch sẽ được tự động tạo sau khi đặt
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
                          Tuần này: {doc.bookedSlots}/{doc.totalSlots} lịch hẹn •&nbsp;
                          {doc.freeSlots > 0
                            ? <span style={{ color: av.dot, fontWeight: 600 }}>còn {doc.freeSlots} slot</span>
                            : <span style={{ color: '#ef4444', fontWeight: 600 }}>kín lịch</span>
                          }
                        </p>
                        {doc.nextAvailableDate && doc.availability !== 'FULL' && (
                          <p style={{ fontSize: '11px', color: '#16a34a', margin: '2px 0 0' }}>
                            Slot gần nhất: {doc.nextAvailableDate === today ? 'Hôm nay' : new Date(doc.nextAvailableDate).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })} lúc {doc.nextAvailableTime}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Progress bar (only for scheduled doctors) */}
                  {doc.availability !== 'UNSCHEDULED' && (
                  <div style={{ width: '80px', flexShrink: 0 }}>
                    <div style={{ height: '5px', backgroundColor: '#f3f4f6', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '99px', width: `${doc.totalSlots > 0 ? Math.min((doc.bookedSlots / doc.totalSlots) * 100, 100) : 0}%`, backgroundColor: av.dot, transition: 'width .3s' }} />
                    </div>
                    <p style={{ fontSize: '10px', color: '#9ca3af', margin: '3px 0 0', textAlign: 'right' }}>
                      {doc.totalSlots > 0 ? Math.round((doc.bookedSlots / doc.totalSlots) * 100) : 0}%
                    </p>
                  </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Weekly timeline */}
      {selectedDoctor && (
        <div style={card}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={16} color="#2563eb" />
            Lịch tuần — BS. {doctors.find(d => d.id === selectedDoctor)?.name}
          </p>

          {timelineLoading ? (
            <div style={{ textAlign: 'center', padding: '28px' }}>
              <Loader2 size={22} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <WeekTimeline
              weekDays={timeline}
              selectedDate={selectedDate}
              selectedShiftId={selectedShiftId}
              selectedSlot={selectedSlot}
              onSelectSlot={onSelectSlot}
              anyDoctor={anyDoctor}
            />
          )}
        </div>
      )}

      {/* Hint: guide user to pick date+time if doctor selected but no slot yet */}
      {selectedDoctor && !selectedSlot && !timelineLoading && (
        <div style={{ padding: '11px 16px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CalendarDays size={15} color="#d97706" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '13px', color: '#92400e', margin: 0, fontWeight: 500 }}>
            Vui lòng chọn <strong>ngày</strong> và <strong>giờ khám</strong> trong lịch bên trên để tiếp tục
          </p>
        </div>
      )}

      {/* Selected slot summary */}
      {selectedDate && selectedSlot && (
        <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} color="#16a34a" />
          <p style={{ fontSize: '13px', color: '#166534', margin: 0 }}>
            Đã chọn: <strong>BS. {doctors.find(d => d.id === selectedDoctor)?.name}</strong> —{' '}
            <strong>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}</strong>{' '}
            lúc <strong>{selectedSlot}</strong>
          </p>
          <button onClick={() => onSelectSlot('', {} as TimelineShift, '')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <button onClick={onBack} style={{ padding: '10px 22px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#374151' }}>Quay lại</button>
        <button onClick={onConfirm} disabled={!canConfirm || saving}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 28px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: canConfirm && !saving ? 'pointer' : 'not-allowed', backgroundColor: canConfirm ? '#2563eb' : '#e5e7eb', color: canConfirm ? 'white' : '#9ca3af' }}>
          {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          Xác nhận đặt lịch
        </button>
      </div>
    </div>
  )
}

// ─── Success screen ───────────────────────────────────────────

function SuccessScreen({ result, onNew }: { result: CreatedAppointment; onNew: () => void }) {
  const navigate = useNavigate()
  const d = new Date(result.appointmentDate)
  const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  const dateStr = d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ ...card, textAlign: 'center', maxWidth: '480px', margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <CheckCircle2 size={32} color="#16a34a" />
      </div>
      <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Đặt lịch thành công!</h3>
      <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>Lịch hẹn đã được tạo và đang chờ xác nhận</p>

      <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '20px', textAlign: 'left', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>Mã lịch hẹn</span>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#2563eb' }}>{result.code}</span>
        </div>
        {[
          { label: 'Bệnh nhân', value: result.patientName },
          { label: 'SĐT',       value: result.patientPhone },
          { label: 'Bác sĩ',    value: result.doctor?.fullName ? `BS. ${result.doctor.fullName}` : '—' },
          { label: 'Dịch vụ',   value: result.service?.name ?? '—' },
          { label: 'Ngày',      value: dateStr },
          { label: 'Giờ',       value: timeStr },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>{row.label}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827', textAlign: 'right', maxWidth: '60%' }}>{row.value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => navigate('/staff/appointments')}
          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: '#374151' }}>
          Xem danh sách
        </button>
        <button onClick={onNew}
          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#2563eb', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <CalendarPlus size={14} /> Đặt lịch khác
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════

export default function NewAppointmentPage() {
  const [step, setStep]       = useState<1 | 2 | 3>(1)
  const [success, setSuccess] = useState<CreatedAppointment | null>(null)

  // Step 1
  const [patient, setPatient] = useState({ phone: '', name: '', dob: '', gender: '', note: '' })

  // Step 2
  const [services,        setServices]        = useState<BookingService[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [selectedService, setSelectedService] = useState<number | null>(null)
  const [anyDoctor,       setAnyDoctor]       = useState(true)

  // Step 3 — week & doctors
  const [weekStart,       setWeekStart]       = useState(toDateStr(getWeekMonday(new Date())))
  const [doctors,         setDoctors]         = useState<BookingDoctor[]>([])
  const [serviceName,     setServiceName]     = useState('')
  const [doctorsLoading,  setDoctorsLoading]  = useState(false)
  const [selectedDoctor,  setSelectedDoctor]  = useState<number | null>(null)

  // Step 3 — timeline
  const [timeline,        setTimeline]        = useState<TimelineDay[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  // Step 3 — selection
  const [selectedDate,    setSelectedDate]    = useState<string | null>(null)
  const [selectedSlot,    setSelectedSlot]    = useState<string | null>(null)   // HH:MM
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null)
  const [selectedShift,   setSelectedShift]   = useState<TimelineShift | null>(null)

  // Misc
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState('')

  // ── Loaders ────────────────────────────────────────────────

  const loadServices = useCallback(async () => {
    setServicesLoading(true)
    try { setServices((await receptionistApi.getServices()).data) } catch { /* silent */ }
    finally { setServicesLoading(false) }
  }, [])

  const loadDoctors = useCallback(async (serviceId: number, ws: string) => {
    setDoctorsLoading(true)
    try {
      const res = await receptionistApi.getDoctors(serviceId, ws)
      setDoctors(res.data.doctors)
      setServiceName(res.data.serviceName)

      // TH1/TH2: if no doctors this week → auto-jump to next week
      if (res.data.doctors.length === 0) {
        const nextWs = toDateStr(addDays(getWeekMonday(new Date(ws)), 7))
        const r2 = await receptionistApi.getDoctors(serviceId, nextWs)
        if (r2.data.doctors.length > 0) {
          setWeekStart(nextWs)
          setDoctors(r2.data.doctors)
        }
      }
    } catch { /* silent */ }
    finally { setDoctorsLoading(false) }
  }, [])

  const loadTimeline = useCallback(async (doctorId: number, ws: string) => {
    setTimelineLoading(true)
    setSelectedDate(null); setSelectedSlot(null); setSelectedShiftId(null); setSelectedShift(null)
    try { setTimeline((await receptionistApi.getDoctorWeek(doctorId, ws)).data.weekDays) }
    catch { /* silent */ }
    finally { setTimelineLoading(false) }
  }, [])

  // Reload timeline when week changes and doctor is selected
  useEffect(() => {
    if (step === 3 && selectedDoctor) loadTimeline(selectedDoctor, weekStart)
  }, [weekStart]) // eslint-disable-line

  // Reload doctors when week changes at step 3
  useEffect(() => {
    if (step === 3 && selectedService) {
      setSelectedDoctor(null)
      setTimeline([]); setSelectedDate(null); setSelectedSlot(null)
      loadDoctors(selectedService, weekStart)
    }
  }, [weekStart]) // eslint-disable-line

  // ── Navigation ────────────────────────────────────────────

  const goToStep2 = () => {
    setStep(2)
    if (services.length === 0) loadServices()
  }

  const goToStep3 = () => {
    if (!selectedService) return
    setStep(3)
    loadDoctors(selectedService, weekStart)
  }

  const goBack = () => {
    if (step === 2) setStep(1)
    if (step === 3) { setStep(2); setSelectedDoctor(null); setTimeline([]); setSelectedDate(null); setSelectedSlot(null) }
  }

  const handleSelectDoctor = (id: number) => {
    setSelectedDoctor(id)
    setSelectedDate(null); setSelectedSlot(null); setSelectedShiftId(null); setSelectedShift(null)
    loadTimeline(id, weekStart)
  }

  const handleSelectSlot = (date: string, shift: TimelineShift, time: string) => {
    if (!date) { setSelectedDate(null); setSelectedSlot(null); setSelectedShiftId(null); setSelectedShift(null); return }
    setSelectedDate(date)
    setSelectedSlot(time)
    setSelectedShiftId(shift.shiftId)
    setSelectedShift(shift)
  }

  const handleChangeWeek = (ws: string) => {
    const today = toDateStr(getWeekMonday(new Date()))
    if (ws < today) return  // don't go before current week
    setWeekStart(ws)
  }

  // ── Confirm booking ───────────────────────────────────────

  const handleConfirm = async () => {
    if (!selectedDoctor || !selectedSlot || !selectedService || !selectedDate) return
    setSaving(true); setSaveError('')
    try {
      const appointmentDate = `${selectedDate}T${selectedSlot}`
      const res = await receptionistApi.createAppointment({
        patientName:     patient.name,
        patientPhone:    patient.phone,
        patientDob:      patient.dob  || null,
        patientGender:   patient.gender || null,
        note:            patient.note  || null,
        doctorId:        selectedDoctor,
        serviceId:       selectedService,
        appointmentDate,
        shiftId:         selectedShift?.isUnscheduled ? selectedShiftId : null,
      })
      setSuccess(res.data)
    } catch (e: any) {
      setSaveError(e.response?.data?.message || 'Lỗi khi đặt lịch. Vui lòng thử lại.')
    } finally { setSaving(false) }
  }

  // ── Reset ─────────────────────────────────────────────────

  const resetAll = () => {
    setStep(1); setSuccess(null)
    setPatient({ phone: '', name: '', dob: '', gender: '', note: '' })
    setSelectedService(null); setAnyDoctor(true)
    setWeekStart(toDateStr(getWeekMonday(new Date())))
    setSelectedDoctor(null); setTimeline([])
    setSelectedDate(null); setSelectedSlot(null); setSelectedShiftId(null); setSelectedShift(null)
    setSaveError('')
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div>
      {success ? (
        <SuccessScreen result={success} onNew={resetAll} />
      ) : (
        <>
          <StepBar step={step} />

          {saveError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', marginBottom: '14px', color: '#dc2626', fontSize: '13px' }}>
              <X size={15} style={{ flexShrink: 0 }} /> {saveError}
            </div>
          )}

          {step === 1 && (
            <Step1 form={patient} onChange={p => setPatient(prev => ({ ...prev, ...p }))} onNext={goToStep2} />
          )}

          {step === 2 && (
            <Step2
              services={services} selectedService={selectedService} anyDoctor={anyDoctor}
              onSelectService={setSelectedService} onToggleDoctor={setAnyDoctor}
              onNext={goToStep3} onBack={goBack} loading={servicesLoading}
            />
          )}

          {step === 3 && (
            <Step3
              doctors={doctors} serviceName={serviceName} anyDoctor={anyDoctor}
              selectedDoctor={selectedDoctor} onSelectDoctor={handleSelectDoctor}
              weekStart={weekStart} onChangeWeek={handleChangeWeek}
              timeline={timeline} timelineLoading={timelineLoading}
              selectedSlot={selectedSlot} selectedShiftId={selectedShiftId} selectedDate={selectedDate}
              onSelectSlot={handleSelectSlot}
              onConfirm={handleConfirm} onBack={goBack} saving={saving}
              doctorsLoading={doctorsLoading}
            />
          )}
        </>
      )}
    </div>
  )
}
