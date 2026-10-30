import { useState, useEffect, useCallback } from 'react'
import {
  X, Loader2, AlertTriangle, Eye, EyeOff, Send, CheckCircle2,
  XCircle, Clock, MessageSquare, BarChart3, AlertCircle, RefreshCw,
  ChevronLeft, ChevronRight, Pencil,
} from 'lucide-react'
import { smsApi, type SmsConfig, type SmsTemplate, type SmsLog, type SmsStats } from '../../api/sms.api'

// ─── Constants ────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  CONFIRM_BOOKING: 'Xác nhận đặt lịch',
  REMINDER_24H:    'Nhắc lịch hẹn',
  REMINDER_2H:     'Nhắc trước 2h',
  CANCEL:          'Thông báo hủy',
  RESCHEDULE:      'Thay đổi lịch',
}

const TYPE_DESCRIPTIONS: Record<string, string> = {
  CONFIRM_BOOKING: 'Gửi khi lễ tân tạo thành công lịch hẹn',
  REMINDER_24H:    'Nhắc nhở trước lúc khám T-24h (scheduler)',
  REMINDER_2H:     'Nhắc nhở ngắn gọn T-2h trước giờ khám',
  CANCEL:          'Gửi khi lịch hẹn bị hủy (UC03)',
  RESCHEDULE:      'Gửi khi lịch hẹn bị thay đổi (UC02)',
}

const PROVIDERS = [
  { value: 'VIETTEL', label: 'Viettel SMS' },
  { value: 'ESMS',    label: 'eSMS.io' },
  { value: 'TWILIO',  label: 'Twilio' },
  { value: 'OTHER',   label: 'Khác' },
]

// ─── Helpers ──────────────────────────────────────────────────

const fmtDateTime = (s: string | null): string => {
  if (!s) return '—'
  const d = new Date(s)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const smsMsgCount = (content: string): { chars: number; msgs: number } => {
  const chars = content.length
  const msgs  = chars <= 160 ? 1 : Math.ceil(chars / 153)
  return { chars, msgs }
}

// ─── Shared UI ────────────────────────────────────────────────

const btnStyle = {
  base:    { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none' } as React.CSSProperties,
  primary: { backgroundColor: '#2563eb', color: 'white' } as React.CSSProperties,
  ghost:   { backgroundColor: 'white', color: '#374151', border: '1px solid #e5e7eb' } as React.CSSProperties,
}

const inputCss: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb',
  borderRadius: '8px', fontSize: '14px', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
}

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, backgroundColor: type === 'success' ? '#22c55e' : '#ef4444', color: 'white', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,.15)', display: 'flex', alignItems: 'center', gap: '10px' }}>
      {type === 'success' ? '✓' : '✕'} {msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
    </div>
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {msg}
    </div>
  )
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      {children}
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{ width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer', backgroundColor: checked ? '#2563eb' : '#e5e7eb', position: 'relative', flexShrink: 0, transition: 'background .2s' }}
    >
      <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white', position: 'absolute', top: '3px', left: checked ? '25px' : '3px', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
    </button>
  )
}

// ─── Template Edit Modal ──────────────────────────────────────

function TemplateEditModal({ template, onSave, onClose }: {
  template: SmsTemplate
  onSave:   (content: string) => Promise<void>
  onClose:  () => void
}) {
  const [content, setContent] = useState(template.content)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const { chars, msgs } = smsMsgCount(content)

  const insertVar = (v: string) => setContent(c => c + v)

  const handleSave = async () => {
    if (!content.trim()) { setError('Nội dung không được để trống'); return }
    setLoading(true); setError('')
    try   { await onSave(content.trim()) }
    catch (e: any) { setError(e.response?.data?.message || 'Lỗi hệ thống'); setLoading(false) }
  }

  return (
    <Overlay>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>Chỉnh sửa mẫu SMS</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{template.name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '16px 24px', overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && <ErrorBanner msg={error} />}

          {/* Variable hint buttons */}
          <div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '8px' }}>Chèn biến vào nội dung:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {['[Tên BN]', '[Ngày]', '[Giờ]', '[Bác sĩ]'].map(v => (
                <button key={v} onClick={() => insertVar(v)}
                  style={{ padding: '4px 10px', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', color: '#2563eb', background: '#eff6ff', cursor: 'pointer', fontFamily: 'monospace' }}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              style={{ ...inputCss, resize: 'vertical' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
              <p style={{ fontSize: '11px', color: chars > 306 ? '#dc2626' : '#9ca3af' }}>
                {chars} ký tự
              </p>
              <p style={{ fontSize: '11px', color: '#9ca3af' }}>
                {msgs} tin nhắn
                {msgs > 1 && <span style={{ color: '#d97706' }}> (tính phí x{msgs})</span>}
              </p>
            </div>
          </div>

          {/* Preview */}
          <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '12px 14px', border: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Xem trước</p>
            <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5, margin: 0 }}>
              {content
                .replace(/\[Tên BN\]/g, 'Nguyễn Văn A')
                .replace(/\[Ngày\]/g,   '01/06/2026')
                .replace(/\[Giờ\]/g,    '09:00')
                .replace(/\[Bác sĩ\]/g, 'BS. Trần B')
              }
            </p>
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{ ...btnStyle.base, ...btnStyle.ghost }}>Hủy</button>
          <button onClick={handleSave} disabled={loading} style={{ ...btnStyle.base, ...btnStyle.primary, opacity: loading ? .7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Lưu mẫu
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ─── Test SMS Modal ───────────────────────────────────────────

function TestSmsModal({ templates, onClose, onSent }: {
  templates: SmsTemplate[]
  onClose:   () => void
  onSent:    () => void
}) {
  const [phone,   setPhone]   = useState('')
  const [type,    setType]    = useState(templates[0]?.type ?? 'CONFIRM_BOOKING')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [result,  setResult]  = useState<string | null>(null)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await smsApi.sendTest({ phone, type })
      const mode = (res.data as any).simulated ? ' (mô phỏng — chưa cấu hình credentials)' : ' (đã gửi thật qua eSMS.io)'
      setResult(`Gửi tới ${res.data.phone} – ${res.data.templateName}${mode}`)
      onSent()
    } catch (e: any) {
      setError(e.response?.data?.message || 'Lỗi gửi SMS')
    } finally { setLoading(false) }
  }

  return (
    <Overlay>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>Gửi SMS thử nghiệm</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Kiểm tra kết nối và mẫu tin nhắn</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSend} style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error  && <ErrorBanner msg={error} />}
          {result && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', color: '#16a34a', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <CheckCircle2 size={15} /> {result}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Số điện thoại thử nghiệm <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
              style={inputCss}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Mẫu tin</label>
            <select value={type} onChange={e => setType(e.target.value)}
              style={{ ...inputCss, appearance: 'none', cursor: 'pointer' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
            >
              {templates.map(t => <option key={t.type} value={t.type}>{t.name}</option>)}
            </select>
          </div>

          <button type="submit" disabled={loading} style={{ ...btnStyle.base, ...btnStyle.primary, justifyContent: 'center', opacity: loading ? .7 : 1 }}>
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
            Gửi SMS thử
          </button>
        </form>
      </div>
    </Overlay>
  )
}

// ─── Stat Card ────────────────────────────────────────────────

function StatCard({ icon, value, label, sub, iconBg, iconColor }: {
  icon:      React.ReactNode
  value:     string | number
  label:     string
  sub?:      string
  iconBg:    string
  iconColor: string
}) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
      <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '26px', fontWeight: 800, color: '#111827', margin: 0, lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: '13px', fontWeight: 500, color: iconColor, margin: '2px 0 0' }}>{sub}</p>}
        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: sub ? '2px' : '4px' }}>{label}</p>
      </div>
    </div>
  )
}

// ─── Template Card ────────────────────────────────────────────

function TemplateCard({ template, onToggle, onEdit }: {
  template: SmsTemplate
  onToggle: (enabled: boolean) => void
  onEdit:   () => void
}) {
  const { chars, msgs } = smsMsgCount(template.content)

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '10px', border: `1px solid ${template.isEnabled ? '#e5e7eb' : '#f3f4f6'}`, padding: '14px 16px', opacity: template.isEnabled ? 1 : 0.65 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', flex: 1 }}>
          <input
            type="checkbox" checked={template.isEnabled} onChange={e => onToggle(e.target.checked)}
            style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#2563eb', flexShrink: 0 }}
          />
          <div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>{template.name}</p>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{TYPE_DESCRIPTIONS[template.type] ?? ''}</p>
          </div>
        </label>
        <button onClick={onEdit} style={{ fontSize: '13px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px', padding: '4px' }}>
          <Pencil size={12} /> Chỉnh sửa
        </button>
      </div>

      <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 8px', lineHeight: 1.55, backgroundColor: '#f9fafb', padding: '8px 10px', borderRadius: '6px', fontFamily: 'monospace' }}>
        {template.content.length > 130 ? template.content.slice(0, 130) + '…' : template.content}
      </p>

      <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>{chars} ký tự · {msgs} tin nhắn</p>
    </div>
  )
}

// ─── SMS Log Table ────────────────────────────────────────────

function SmsLogTable({ logs, total, page, pages, onPageChange, loading }: {
  logs:         SmsLog[]
  total:        number
  page:         number
  pages:        number
  onPageChange: (p: number) => void
  loading:      boolean
}) {
  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      SUCCESS: { label: 'Thành công', color: '#16a34a', bg: '#f0fdf4' },
      FAILED:  { label: 'Thất bại',   color: '#dc2626', bg: '#fef2f2' },
      PENDING: { label: 'Đang chờ',   color: '#d97706', bg: '#fef3c7' },
    }
    const s = map[status] ?? map.PENDING
    return (
      <span style={{ fontSize: '11px', fontWeight: 700, color: s.color, backgroundColor: s.bg, padding: '3px 8px', borderRadius: '99px' }}>
        {s.label}
      </span>
    )
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  )

  if (logs.length === 0) return (
    <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
      <MessageSquare size={28} style={{ marginBottom: '8px' }} />
      <p style={{ fontSize: '13px', margin: 0 }}>Chưa có lịch sử gửi SMS</p>
    </div>
  )

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['NGƯỜI NHẬN', 'LOẠI TIN', 'TRẠNG THÁI', 'THỜI GIAN', 'NỘI DUNG'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: i % 2 ? '#fafafa' : 'white' }}>
                <td style={{ padding: '10px 12px' }}>
                  <p style={{ fontWeight: 600, color: '#111827', margin: 0 }}>{log.recipientName || '—'}</p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>{log.phone}</p>
                </td>
                <td style={{ padding: '10px 12px', color: '#374151' }}>
                  {TYPE_LABELS[log.type] ?? log.type}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <StatusBadge status={log.status} />
                </td>
                <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {fmtDateTime(log.sentAt ?? log.createdAt)}
                </td>
                <td style={{ padding: '10px 12px', color: '#374151', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.content}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #f3f4f6' }}>
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
            Tổng {total} tin nhắn
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              style={{ width: '30px', height: '30px', border: '1px solid #e5e7eb', borderRadius: '6px', background: 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? .4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={14} color="#6b7280" />
            </button>
            <span style={{ fontSize: '13px', color: '#374151' }}>Trang {page} / {pages}</span>
            <button
              disabled={page >= pages}
              onClick={() => onPageChange(page + 1)}
              style={{ width: '30px', height: '30px', border: '1px solid #e5e7eb', borderRadius: '6px', background: 'white', cursor: page >= pages ? 'not-allowed' : 'pointer', opacity: page >= pages ? .4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={14} color="#6b7280" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════

export default function SmsPage() {
  // ── Data state ────────────────────────────────────────────
  const [config,    setConfig]    = useState<SmsConfig | null>(null)
  const [templates, setTemplates] = useState<SmsTemplate[]>([])
  const [stats,     setStats]     = useState<SmsStats | null>(null)
  const [logs,      setLogs]      = useState<SmsLog[]>([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage,  setLogsPage]  = useState(1)
  const [logsPages, setLogsPages] = useState(1)
  const [logsLoading, setLogsLoading] = useState(false)

  // ── UI state ──────────────────────────────────────────────
  const [leftView,    setLeftView]    = useState<'settings' | 'history'>('settings')
  const [editTpl,     setEditTpl]     = useState<SmsTemplate | null>(null)
  const [testOpen,    setTestOpen]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [initLoading, setInitLoading] = useState(true)
  const [toast, setToast]             = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // ── Gateway form state (synced from config) ────────────────
  const [isEnabled,  setIsEnabled]  = useState(true)
  const [provider,   setProvider]   = useState('VIETTEL')
  const [apiKey,     setApiKey]     = useState('')
  const [showKey,    setShowKey]    = useState(false)
  const [secretKey,  setSecretKey]  = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [brandname,  setBrandname]  = useState('DentCare')
  const [dailyLimit, setDailyLimit] = useState(500)
  const [quietStart, setQuietStart] = useState('21:00')
  const [quietEnd,   setQuietEnd]   = useState('07:00')

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type })

  // ── Loaders ───────────────────────────────────────────────
  const loadInit = useCallback(async () => {
    setInitLoading(true)
    try {
      const [cfgRes, statsRes] = await Promise.all([smsApi.getConfig(), smsApi.getStats()])
      const { config: cfg, templates: tpls } = cfgRes.data
      setConfig(cfg); setTemplates(tpls); setStats(statsRes.data)
      // Sync form
      setIsEnabled(cfg.isEnabled)
      setProvider(cfg.provider)
      setApiKey(cfg.apiKey ?? '')
      setSecretKey(cfg.secretKey ?? '')
      setBrandname(cfg.brandname)
      setDailyLimit(cfg.dailyLimit)
      setQuietStart(cfg.quietStart)
      setQuietEnd(cfg.quietEnd)
    } catch { showToast('Không thể tải dữ liệu SMS', 'error') }
    finally { setInitLoading(false) }
  }, [])

  const loadStats = useCallback(async () => {
    try { const res = await smsApi.getStats(); setStats(res.data) } catch { /* silent */ }
  }, [])

  const loadLogs = useCallback(async (page = 1) => {
    setLogsLoading(true)
    try {
      const res = await smsApi.getLogs({ page, limit: 20 })
      setLogs(res.data.logs)
      setLogsTotal(res.data.total)
      setLogsPage(res.data.page)
      setLogsPages(res.data.pages)
    } catch { showToast('Không thể tải lịch sử SMS', 'error') }
    finally { setLogsLoading(false) }
  }, [])

  useEffect(() => { loadInit() }, [loadInit])

  useEffect(() => {
    if (leftView === 'history') loadLogs(1)
  }, [leftView, loadLogs])

  // ── Handlers ──────────────────────────────────────────────
  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      await smsApi.updateConfig({
        isEnabled, provider,
        apiKey:    apiKey     || null,
        secretKey: secretKey  || null,
        brandname, dailyLimit, quietStart, quietEnd,
      })
      showToast('Lưu cấu hình thành công')
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Lỗi khi lưu cấu hình', 'error')
    } finally { setSaving(false) }
  }

  const handleToggleTemplate = async (type: string, enabled: boolean) => {
    try {
      await smsApi.updateTemplate(type, { isEnabled: enabled })
      setTemplates(prev => prev.map(t => t.type === type ? { ...t, isEnabled: enabled } : t))
    } catch { showToast('Lỗi cập nhật mẫu SMS', 'error') }
  }

  const handleSaveTemplate = async (content: string) => {
    if (!editTpl) return
    await smsApi.updateTemplate(editTpl.type, { content })
    setTemplates(prev => prev.map(t => t.type === editTpl.type ? { ...t, content } : t))
    setEditTpl(null)
    showToast('Cập nhật mẫu SMS thành công')
  }

  // ── Computed ──────────────────────────────────────────────
  const fmtRate = stats ? `${stats.successRate}%` : '—'

  if (initLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
      <Loader2 size={32} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
            Cấu hình Thông báo SMS <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 400 }}>(UC10)</span>
          </h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Quản lý mẫu tin nhắn và cấu hình gửi tự động</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleSaveConfig} disabled={saving} style={{ ...btnStyle.base, ...btnStyle.ghost, opacity: saving ? .7 : 1 }}>
            {saving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            Lưu cấu hình
          </button>
          <button onClick={() => setTestOpen(true)} style={{ ...btnStyle.base, ...btnStyle.primary }}>
            <Send size={14} /> Gửi SMS thử
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <StatCard icon={<Send size={20} color="#2563eb" />}          value={stats?.sentThisMonth ?? 0}  label="SMS đã gửi tháng"    iconBg="#dbeafe" iconColor="#2563eb" />
        <StatCard icon={<CheckCircle2 size={20} color="#16a34a" />}  value={fmtRate}                    label="Tỉ lệ thành công"    iconBg="#dcfce7" iconColor="#16a34a" />
        <StatCard icon={<XCircle size={20} color="#dc2626" />}       value={stats?.failed ?? 0}         label="SMS thất bại"        iconBg="#fee2e2" iconColor="#dc2626" />
        <StatCard icon={<Clock size={20} color="#9333ea" />}         value={stats?.scheduled ?? 0}      label="Đã lên lịch"         iconBg="#ede9fe" iconColor="#9333ea" />
      </div>

      {/* ── Main two-panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start', marginBottom: '20px' }}>

        {/* LEFT: templates or history */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {/* Panel header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>Mẫu tin nhắn</p>
            <div style={{ display: 'flex', gap: '2px' }}>
              {(['settings', 'history'] as const).map(v => (
                <button key={v} onClick={() => setLeftView(v)}
                  style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: leftView === v ? 700 : 400, backgroundColor: leftView === v ? '#eff6ff' : 'transparent', color: leftView === v ? '#2563eb' : '#6b7280' }}>
                  {v === 'settings' ? 'Cài đặt chung' : 'Lịch sử gửi'}
                </button>
              ))}
            </div>
          </div>

          {/* Panel content */}
          {leftView === 'settings' ? (
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {templates.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '32px', color: '#9ca3af', fontSize: '13px' }}>Đang tải mẫu…</p>
              ) : templates.map(t => (
                <TemplateCard
                  key={t.type}
                  template={t}
                  onToggle={enabled => handleToggleTemplate(t.type, enabled)}
                  onEdit={() => setEditTpl(t)}
                />
              ))}
            </div>
          ) : (
            <SmsLogTable
              logs={logs} total={logsTotal} page={logsPage} pages={logsPages}
              loading={logsLoading}
              onPageChange={p => loadLogs(p)}
            />
          )}
        </div>

        {/* RIGHT: gateway settings */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>Cài đặt SMS Gateway</p>

          {/* Enable toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: isEnabled ? '#eff6ff' : '#f9fafb', borderRadius: '8px', border: `1px solid ${isEnabled ? '#bfdbfe' : '#e5e7eb'}` }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: isEnabled ? '#1d4ed8' : '#374151', margin: 0 }}>Bật/tắt SMS tự động</p>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Cho phép hệ thống gửi SMS tự động</p>
            </div>
            <ToggleSwitch checked={isEnabled} onChange={setIsEnabled} />
          </div>

          {/* Provider */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Nhà cung cấp SMS</label>
            <select value={provider} onChange={e => setProvider(e.target.value)}
              style={{ ...inputCss, appearance: 'none', cursor: 'pointer' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
            >
              {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {/* Credentials status */}
          {(() => {
            const hasCredentials = !!(apiKey && secretKey)
            return (
              <div style={{ padding: '9px 12px', borderRadius: '8px', border: `1px solid ${hasCredentials ? '#bbf7d0' : '#fcd34d'}`, backgroundColor: hasCredentials ? '#f0fdf4' : '#fffbeb', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {hasCredentials
                  ? <CheckCircle2 size={14} color="#16a34a" />
                  : <AlertCircle  size={14} color="#d97706" />
                }
                <p style={{ fontSize: '12px', color: hasCredentials ? '#166534' : '#92400e', margin: 0, lineHeight: 1.4 }}>
                  {hasCredentials
                    ? 'Credentials đã cấu hình — SMS sẽ gửi qua eSMS.io thật'
                    : 'Chưa đủ credentials — SMS đang chạy ở chế độ mô phỏng'
                  }
                </p>
              </div>
            )
          })()}

          {/* API Key */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              API Key <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Nhập eSMS API key..."
                style={{ ...inputCss, paddingRight: '40px' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
              />
              <button onClick={() => setShowKey(!showKey)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px' }}>
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Secret Key */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Secret Key <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showSecret ? 'text' : 'password'}
                value={secretKey}
                onChange={e => setSecretKey(e.target.value)}
                placeholder="Nhập eSMS Secret key..."
                style={{ ...inputCss, paddingRight: '40px' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
              />
              <button onClick={() => setShowSecret(!showSecret)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px' }}>
                {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
              API Key + Secret Key lấy từ trang quản trị{' '}
              <a href="https://esms.vn" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>esms.vn</a>
            </p>
          </div>

          {/* Brandname */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Tên người gửi (Brandname)</label>
            <input
              type="text" value={brandname} onChange={e => setBrandname(e.target.value)}
              placeholder="DentCare"
              style={inputCss}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
          </div>

          {/* Daily limit */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Giới hạn SMS / ngày</label>
            <input
              type="number" min={1} max={50000} value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))}
              style={inputCss}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
          </div>

          {/* Save hint */}
          <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', margin: 0 }}>
            Nhấn "Lưu cấu hình" để áp dụng thay đổi
          </p>
        </div>
      </div>

      {/* ── Quiet hours + Test SMS + Recent (settings view only) ── */}
      {leftView === 'settings' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>

          {/* Quiet hours card */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={15} color="#d97706" />
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>Lần 1: T-24h</p>
                <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>Khung giờ im lặng</p>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>Không gửi SMS trong khung giờ đêm ngủ bệnh nhân</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '13px', color: '#374151' }}>Từ giờ:</label>
                <input type="time" value={quietStart} onChange={e => setQuietStart(e.target.value)}
                  style={{ padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '13px', color: '#374151' }}>Đến giờ:</label>
                <input type="time" value={quietEnd} onChange={e => setQuietEnd(e.target.value)}
                  style={{ padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
                />
              </div>
            </div>

            <div style={{ marginTop: '10px', backgroundColor: '#fef3c7', borderRadius: '6px', padding: '8px 10px' }}>
              <p style={{ fontSize: '11px', color: '#92400e', margin: 0, lineHeight: 1.4 }}>
                SMS được lên lịch sẽ đợi đến {quietEnd} sáng hôm sau nếu rơi vào khung giờ này
              </p>
            </div>
          </div>

          {/* Test SMS card */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={15} color="#2563eb" />
              </div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>SMS thử nghiệm</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Số điện thoại thử nghiệm</label>
                <input id="test-phone-inline" type="tel" placeholder="Nhập SĐT để test"
                  style={{ ...inputCss, fontSize: '13px' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Mẫu tin</label>
                <select id="test-type-inline" style={{ ...inputCss, fontSize: '13px', appearance: 'none', cursor: 'pointer' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
                >
                  {templates.map(t => <option key={t.type} value={t.type}>{t.name}</option>)}
                </select>
              </div>
              <button
                onClick={() => setTestOpen(true)}
                style={{ ...btnStyle.base, ...btnStyle.primary, justifyContent: 'center', width: '100%' }}>
                <Send size={13} /> Gửi SMS thử
              </button>
            </div>
          </div>

          {/* Recent sends mini card */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={15} color="#9333ea" />
                </div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>Lịch sử gửi SMS</p>
              </div>
              <button onClick={loadStats}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                <RefreshCw size={12} /> Làm mới
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(stats?.recent ?? []).length === 0 ? (
                <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>Chưa có lịch sử</p>
              ) : (stats?.recent ?? []).map(log => (
                <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.recipientName || log.phone}
                    </p>
                    <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>{TYPE_LABELS[log.type] ?? log.type}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{fmtDateTime(log.sentAt ?? log.createdAt)}</span>
                    {log.status === 'SUCCESS'
                      ? <CheckCircle2 size={14} color="#16a34a" />
                      : log.status === 'FAILED'
                        ? <XCircle size={14} color="#dc2626" />
                        : <AlertCircle size={14} color="#d97706" />
                    }
                  </div>
                </div>
              ))}
            </div>

            {(stats?.recent ?? []).length > 0 && (
              <button onClick={() => setLeftView('history')}
                style={{ marginTop: '10px', fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                Xem tất cả →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {editTpl && (
        <TemplateEditModal template={editTpl} onSave={handleSaveTemplate} onClose={() => setEditTpl(null)} />
      )}
      {testOpen && (
        <TestSmsModal
          templates={templates}
          onClose={() => setTestOpen(false)}
          onSent={() => { loadStats(); if (leftView === 'history') loadLogs(1) }}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
