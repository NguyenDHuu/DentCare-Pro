import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, X, RefreshCw, ChevronLeft, ChevronRight,
  MessageSquare, CheckCircle2, XCircle, Clock,
  Phone, User, CalendarDays, ChevronDown, ChevronUp,
  Send, AlertCircle,
} from 'lucide-react'
import { smsApi, type SmsLog } from '../../api/sms.api'

// ─── Constants ────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  CONFIRM_BOOKING: 'Xác nhận đặt lịch',
  REMINDER_24H:    'Nhắc trước 24h',
  REMINDER_2H:     'Nhắc trước 2h',
  CANCEL:          'Thông báo hủy',
  RESCHEDULE:      'Thay đổi lịch',
  CHECKIN:         'Check-in',
}

const TYPE_COLOR: Record<string, { color: string; bg: string }> = {
  CONFIRM_BOOKING: { color: '#2563eb', bg: '#eff6ff' },
  REMINDER_24H:    { color: '#7c3aed', bg: '#f5f3ff' },
  REMINDER_2H:     { color: '#0891b2', bg: '#ecfeff' },
  CANCEL:          { color: '#dc2626', bg: '#fef2f2' },
  RESCHEDULE:      { color: '#d97706', bg: '#fffbeb' },
  CHECKIN:         { color: '#16a34a', bg: '#f0fdf4' },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  SUCCESS: { label: 'Thành công', color: '#16a34a', bg: '#f0fdf4', icon: <CheckCircle2 size={12} /> },
  FAILED:  { label: 'Thất bại',   color: '#dc2626', bg: '#fef2f2', icon: <XCircle      size={12} /> },
  PENDING: { label: 'Đang gửi',   color: '#d97706', bg: '#fffbeb', icon: <Clock        size={12} /> },
}

// ─── Helpers ──────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0') }

function toLocalStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`
}

function fmtFull(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function fmtShort(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return `Hôm nay ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// ─── Single SMS log row ───────────────────────────────────────

function SmsRow({ log }: { log: SmsLog }) {
  const [expanded, setExpanded] = useState(false)
  const statusM = STATUS_META[log.status] ?? STATUS_META['PENDING']
  const typeC   = TYPE_COLOR[log.type]    ?? { color: '#6b7280', bg: '#f3f4f6' }

  return (
    <div style={{
      backgroundColor: 'white',
      border: `1px solid ${log.status === 'FAILED' ? '#fca5a5' : '#f3f4f6'}`,
      borderLeft: `3px solid ${statusM.color}`,
      borderRadius: '10px',
      overflow: 'hidden',
      transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Main row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '180px 130px 120px 1fr 100px 32px',
        gap: '0',
        padding: '12px 16px',
        alignItems: 'center',
      }}>
        {/* Recipient */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
            <User size={12} color="#9ca3af" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
              {log.recipientName ?? 'SMS thử nghiệm'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Phone size={11} color="#9ca3af" />
            <span style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>
              {log.phone}
            </span>
          </div>
        </div>

        {/* Type */}
        <div>
          <span style={{
            display: 'inline-block',
            padding: '3px 9px', borderRadius: '99px',
            fontSize: '11px', fontWeight: 600,
            color: typeC.color, backgroundColor: typeC.bg,
            whiteSpace: 'nowrap',
          }}>
            {TYPE_LABELS[log.type] ?? log.type}
          </span>
        </div>

        {/* Status */}
        <div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 9px', borderRadius: '99px',
            fontSize: '11px', fontWeight: 600,
            color: statusM.color, backgroundColor: statusM.bg,
            whiteSpace: 'nowrap',
          }}>
            {statusM.icon} {statusM.label}
          </span>
        </div>

        {/* Content preview */}
        <div style={{ overflow: 'hidden' }}>
          <p style={{
            fontSize: '12px', color: '#6b7280', margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}>
            {log.content}
          </p>
        </div>

        {/* Time */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CalendarDays size={11} color="#9ca3af" />
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>{fmtShort(log.createdAt)}</span>
          </div>
          {log.status === 'FAILED' && log.errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
              <AlertCircle size={10} color="#dc2626" />
              <span style={{ fontSize: '10px', color: '#dc2626' }}>Có lỗi</span>
            </div>
          )}
        </div>

        {/* Expand btn */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '4px', borderRadius: '4px',
          }}
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          borderTop: '1px solid #f3f4f6',
          padding: '14px 16px',
          backgroundColor: '#fafafa',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
        }}>
          {/* Full content */}
          <div style={{ gridColumn: '1/-1' }}>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Nội dung tin nhắn
            </p>
            <div style={{
              backgroundColor: 'white', border: '1px solid #e5e7eb',
              borderRadius: '8px', padding: '10px 14px',
              fontSize: '13px', color: '#374151', lineHeight: 1.6,
            }}>
              {log.content}
            </div>
          </div>

          {/* Meta info */}
          {[
            { label: 'Số điện thoại',   value: log.phone },
            { label: 'Loại tin nhắn',    value: TYPE_LABELS[log.type] ?? log.type },
            { label: 'Trạng thái',       value: STATUS_META[log.status]?.label ?? log.status },
            { label: 'Số lần thử lại',   value: String(log.retryCount) },
            { label: 'Tạo lúc',          value: fmtFull(log.createdAt) },
            { label: 'Gửi lúc',          value: fmtFull(log.sentAt) },
          ].map(row => (
            <div key={row.label}>
              <p style={{ fontSize: '10px', color: '#9ca3af', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{row.label}</p>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{row.value}</p>
            </div>
          ))}

          {log.errorMsg && (
            <div style={{ gridColumn: '1/-1', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px' }}>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Lỗi gửi SMS</p>
              <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>{log.errorMsg}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Stats mini cards ─────────────────────────────────────────

function StatCard({ icon, label, value, color, bg }: {
  icon: React.ReactNode; label: string; value: number | string; color: string; bg: string
}) {
  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '10px', padding: '14px 16px',
      border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: 0, lineHeight: 1.1 }}>{value}</p>
        <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>{label}</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════

export default function StaffSmsPage() {
  const today = toLocalStr(new Date())

  // ── Filters ───────────────────────────────────────────────
  const [phone,   setPhone]   = useState('')
  const [name,    setName]    = useState('')
  const [dateFrom,setDateFrom]= useState('')
  const [dateTo,  setDateTo]  = useState('')
  const [typeF,   setTypeF]   = useState('')
  const [statusF, setStatusF] = useState('')
  const [page,    setPage]    = useState(1)

  // ── Data ──────────────────────────────────────────────────
  const [logs,    setLogs]    = useState<SmsLog[]>([])
  const [total,   setTotal]   = useState(0)
  const [pages,   setPages]   = useState(1)
  const [loading, setLoading] = useState(false)

  // debounce phone & name
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dPhone, setDPhone] = useState('')
  const [dName,  setDName]  = useState('')
  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => { setDPhone(phone); setDName(name); setPage(1) }, 380)
    return () => { if (debRef.current) clearTimeout(debRef.current) }
  }, [phone, name])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await smsApi.getLogs({
        page,
        limit: 20,
        type:          typeF   || undefined,
        status:        statusF || undefined,
        phone:         dPhone  || undefined,
        recipientName: dName   || undefined,
        dateFrom:      dateFrom || undefined,
        dateTo:        dateTo   || undefined,
      })
      setLogs(res.data.logs)
      setTotal(res.data.total)
      setPages(res.data.pages)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [page, typeF, statusF, dPhone, dName, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  // ── Quick presets ─────────────────────────────────────────
  const setPreset = (from: string, to: string) => {
    setDateFrom(from); setDateTo(to); setPage(1)
  }

  const clearAll = () => {
    setPhone(''); setName(''); setDateFrom(''); setDateTo('')
    setTypeF(''); setStatusF(''); setPage(1)
  }

  const hasFilter = !!(phone || name || dateFrom || dateTo || typeF || statusF)

  // ── Stats from current result ─────────────────────────────
  const success = logs.filter(l => l.status === 'SUCCESS').length
  const failed  = logs.filter(l => l.status === 'FAILED').length
  const pending = logs.filter(l => l.status === 'PENDING').length

  return (
    <div style={{ maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={18} color="#2563eb" />
            </div>
            Lịch sử gửi SMS
          </h2>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0, paddingLeft: '46px' }}>
            Tra cứu toàn bộ tin nhắn SMS đã gửi cho bệnh nhân
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px', borderRadius: '8px',
          border: '1.5px solid #e5e7eb', backgroundColor: 'white',
          color: '#374151', fontWeight: 600, fontSize: '13px',
          cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
        }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Làm mới
        </button>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <StatCard icon={<Send size={18} />}         label="Tổng tin nhắn"   value={total}   color="#2563eb" bg="#eff6ff" />
        <StatCard icon={<CheckCircle2 size={18} />}  label="Thành công"      value={success} color="#16a34a" bg="#f0fdf4" />
        <StatCard icon={<XCircle size={18} />}       label="Thất bại"        value={failed}  color="#dc2626" bg="#fef2f2" />
        <StatCard icon={<Clock size={18} />}         label="Đang xử lý"      value={pending} color="#d97706" bg="#fffbeb" />
      </div>

      {/* ── Filter panel ── */}
      <div style={{
        backgroundColor: 'white', borderRadius: '12px', padding: '16px 20px',
        border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex', flexDirection: 'column', gap: '12px',
      }}>
        {/* Row 1: search inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
          {/* Phone */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Số điện thoại
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={12} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text" value={phone} placeholder="0901..."
                onChange={e => setPhone(e.target.value)}
                style={{ width: '100%', padding: '8px 10px 8px 28px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Tên người nhận
            </label>
            <div style={{ position: 'relative' }}>
              <User size={12} color="#9ca3af" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text" value={name} placeholder="Nguyễn Văn A..."
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px 8px 28px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
              />
            </div>
          </div>

          {/* Date from */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Từ ngày
            </label>
            <input
              type="date" value={dateFrom} max={dateTo || today}
              onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
          </div>

          {/* Date to */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Đến ngày
            </label>
            <input
              type="date" value={dateTo} min={dateFrom} max={today}
              onChange={e => { setDateTo(e.target.value); setPage(1) }}
              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
          </div>
        </div>

        {/* Row 2: type + status + presets */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Type */}
          <select value={typeF} onChange={e => { setTypeF(e.target.value); setPage(1) }} style={{
            padding: '7px 10px', border: '1.5px solid #e5e7eb', borderRadius: '8px',
            fontSize: '13px', outline: 'none', backgroundColor: 'white',
            color: typeF ? '#111827' : '#9ca3af', minWidth: '170px',
          }}>
            <option value="">Tất cả loại SMS</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          {/* Status */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { key: '', label: 'Tất cả' },
              { key: 'SUCCESS', label: 'Thành công' },
              { key: 'FAILED',  label: 'Thất bại' },
              { key: 'PENDING', label: 'Đang gửi' },
            ].map(s => {
              const meta = s.key ? STATUS_META[s.key] : null
              const active = statusF === s.key
              return (
                <button key={s.key} onClick={() => { setStatusF(s.key); setPage(1) }} style={{
                  padding: '6px 12px', borderRadius: '99px', border: `1.5px solid ${active && meta ? meta.color : '#e5e7eb'}`,
                  backgroundColor: active && meta ? meta.bg : 'white',
                  color: active && meta ? meta.color : '#6b7280',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                  {s.label}
                </button>
              )
            })}
          </div>

          {/* Date presets */}
          <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af', alignSelf: 'center' }}>Nhanh:</span>
            {[
              { label: 'Hôm nay',  from: today, to: today },
              { label: '7 ngày',   from: toLocalStr(new Date(Date.now() - 6*86400000)), to: today },
              { label: '30 ngày',  from: toLocalStr(new Date(Date.now() - 29*86400000)), to: today },
            ].map(p => (
              <button key={p.label} onClick={() => setPreset(p.from, p.to)} style={{
                padding: '5px 10px', borderRadius: '7px', border: '1.5px solid #e5e7eb',
                backgroundColor: dateFrom === p.from && dateTo === p.to ? '#eff6ff' : 'white',
                color: dateFrom === p.from && dateTo === p.to ? '#2563eb' : '#6b7280',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              }}>
                {p.label}
              </button>
            ))}
            {hasFilter && (
              <button onClick={clearAll} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '5px 10px', borderRadius: '7px',
                border: '1.5px solid #fca5a5', backgroundColor: '#fef2f2',
                color: '#dc2626', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              }}>
                <X size={11} /> Xóa lọc
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table header ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '180px 130px 120px 1fr 100px 32px',
        gap: '0',
        padding: '8px 16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #f3f4f6',
      }}>
        {['NGƯỜI NHẬN', 'LOẠI TIN', 'TRẠNG THÁI', 'NỘI DUNG', 'THỜI GIAN', ''].map((h, i) => (
          <span key={i} style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {h}
          </span>
        ))}
      </div>

      {/* ── Log list ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
          <RefreshCw size={28} color="#3b82f6" style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 10px' }} />
          <p style={{ fontSize: '13px', margin: 0 }}>Đang tải lịch sử SMS...</p>
        </div>
      ) : logs.length === 0 ? (
        <div style={{
          backgroundColor: 'white', borderRadius: '12px', padding: '56px 32px',
          border: '1px solid #f3f4f6', textAlign: 'center',
        }}>
          <MessageSquare size={40} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>
            Không có tin nhắn nào
          </p>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
            {hasFilter ? 'Thử thay đổi bộ lọc tìm kiếm' : 'Chưa có SMS nào được gửi'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {logs.map(log => <SmsRow key={log.id} log={log} />)}
        </div>
      )}

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', backgroundColor: 'white', borderRadius: '10px',
          border: '1px solid #f3f4f6',
        }}>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
            Trang {page}/{pages} · {total} tin nhắn
          </p>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{
              display: 'flex', alignItems: 'center', padding: '6px 10px',
              borderRadius: '7px', border: '1.5px solid #e5e7eb',
              backgroundColor: 'white', cursor: page === 1 ? 'default' : 'pointer',
              color: '#374151', opacity: page === 1 ? 0.4 : 1,
            }}>
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const half  = 2
              let start = Math.max(1, page - half)
              const end = Math.min(pages, start + 4)
              start = Math.max(1, end - 4)
              const n = start + i
              if (n > pages) return null
              return (
                <button key={n} onClick={() => setPage(n)} style={{
                  padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontWeight: n === page ? 700 : 500, fontSize: '13px', minWidth: '36px',
                  backgroundColor: n === page ? '#2563eb' : 'white',
                  color: n === page ? 'white' : '#374151',
                  border: n === page ? 'none' : '1.5px solid #e5e7eb',
                } as React.CSSProperties}>
                  {n}
                </button>
              )
            })}

            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{
              display: 'flex', alignItems: 'center', padding: '6px 10px',
              borderRadius: '7px', border: '1.5px solid #e5e7eb',
              backgroundColor: 'white', cursor: page === pages ? 'default' : 'pointer',
              color: '#374151', opacity: page === pages ? 0.4 : 1,
            }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
