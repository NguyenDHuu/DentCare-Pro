import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Download, Filter, ChevronLeft, ChevronRight, Info, X } from 'lucide-react'
import { authApi } from '../../api/auth.api'

// ─── Constants ───────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  SETUP_ADMIN:            'Khởi tạo hệ thống',
  REGISTER_ADMIN:         'Đăng ký Admin',
  LOGIN:                  'Đăng nhập',
  LOGIN_FAILED:           'Đăng nhập thất bại',
  LOGOUT:                 'Đăng xuất',
  CHANGE_PASSWORD:        'Đổi mật khẩu',
  REQUEST_RESET_PASSWORD: 'Quên mật khẩu',
  RESET_PASSWORD:         'Đặt lại mật khẩu',
  CREATE_STAFF:           'Tạo tài khoản',
  UPDATE_ROLES:           'Cập nhật vai trò',
  TOGGLE_STATUS:          'Khóa/Mở tài khoản',
  DELETE_USER:            'Xóa tài khoản',
  UPDATE_PROFILE:         'Cập nhật thông tin',
  ADMIN_RESET_PASSWORD:   'Đặt lại mật khẩu',
  SEND_EMAIL:             'Gửi email',
  UPLOAD_CERTIFICATE:     'Tải lên chứng chỉ',
  DELETE_CERTIFICATE:     'Xóa chứng chỉ',
}

const MODULE_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  Auth:    { color: '#2563eb', bg: '#eff6ff', label: 'Auth' },
  User:    { color: '#7c3aed', bg: '#f5f3ff', label: 'User' },
  Service: { color: '#d97706', bg: '#fffbeb', label: 'Service' },
  System:  { color: '#6b7280', bg: '#f3f4f6', label: 'System' },
}

const ACTIONS = Object.entries(ACTION_LABEL).map(([k, v]) => ({ key: k, label: v }))

// ─── Detail Dialog ────────────────────────────────────────────
function DetailDialog({ log, onClose }: { log: any; onClose: () => void }) {
  const mod = MODULE_STYLE[log.module] ?? MODULE_STYLE.System
  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '14px', width: '460px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>Chi tiết nhật ký</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={16} /></button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { label: 'Mã log',      value: `#${log.id}` },
            { label: 'Thời gian',   value: new Date(log.createdAt).toLocaleString('vi-VN') },
            { label: 'Hành động',   value: ACTION_LABEL[log.action] ?? log.action },
            { label: 'Module',      value: log.module },
            { label: 'Người dùng',  value: log.user ? `${log.user.fullName} (${log.user.email})` : '—' },
            { label: 'Trạng thái',  value: log.status === 'SUCCESS' ? 'Thành công' : 'Thất bại' },
            { label: 'Chi tiết',    value: log.detail ?? '—' },
            { label: 'IP',          value: log.ip ?? '—' },
          ].map(row => (
            <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '8px', alignItems: 'start' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>{row.label}</span>
              <span style={{ fontSize: '13px', color: '#111827', wordBreak: 'break-all' }}>
                {row.label === 'Trạng thái' ? (
                  <span style={{
                    display: 'inline-block', fontSize: '11px', fontWeight: 600,
                    padding: '2px 8px', borderRadius: '20px',
                    color: log.status === 'SUCCESS' ? '#16a34a' : '#dc2626',
                    backgroundColor: log.status === 'SUCCESS' ? '#dcfce7' : '#fef2f2',
                  }}>{row.value}</span>
                ) : row.label === 'Module' ? (
                  <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', color: mod.color, backgroundColor: mod.bg }}>
                    {row.value}
                  </span>
                ) : row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function LogsPage() {
  const [search, setSearch]         = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [action, setAction]         = useState('')
  const [status, setStatus]         = useState('')
  const [module, setModule]         = useState('')
  const [startDate, setStartDate]   = useState('')
  const [endDate, setEndDate]       = useState('')
  const [page, setPage]             = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [detailLog, setDetailLog]   = useState<any>(null)
  const LIMIT = 10

  const params = { search, action, status, module, startDate, endDate, page, limit: LIMIT }

  const { data, isLoading, isError } = useQuery<{ logs: any[]; total: number; totalPages: number }>({
    queryKey: ['logs', params],
    queryFn: () => authApi.getLogs(params).then(r => r.data),
  })

  const logs: any[]  = data?.logs ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1

  const handleSearch = useCallback(() => {
    setSearch(searchInput)
    setPage(1)
  }, [searchInput])

  const handleFilterChange = () => setPage(1)

  const clearFilters = () => {
    setSearchInput(''); setSearch('')
    setAction(''); setStatus(''); setModule('')
    setStartDate(''); setEndDate('')
    setPage(1)
  }

  const hasFilters = search || action || status || module || startDate || endDate

  const exportParams = { search, action, status, module, startDate, endDate }

  const selectStyle: React.CSSProperties = {
    appearance: 'none', padding: '8px 32px 8px 12px',
    borderRadius: '8px', border: '1px solid #e5e7eb',
    fontSize: '13px', color: '#374151', backgroundColor: 'white',
    cursor: 'pointer', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Toolbar */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>

          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Tìm theo người dùng, hành động, module..."
              style={{
                paddingLeft: '32px', paddingRight: '12px', height: '36px', width: '100%',
                borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px',
                outline: 'none', color: '#374151', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Total count */}
          <span style={{ fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>
            {isLoading ? '...' : `${total} bản ghi`}
          </span>

          {/* Filter toggle */}
          <button onClick={() => setShowFilters(!showFilters)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px',
            border: `1px solid ${showFilters || hasFilters ? '#2563eb' : '#e5e7eb'}`,
            backgroundColor: showFilters || hasFilters ? '#eff6ff' : 'white',
            color: showFilters || hasFilters ? '#2563eb' : '#374151',
            fontSize: '13px', cursor: 'pointer', fontWeight: 500,
          }}>
            <Filter size={14} /> Bộ lọc
            {hasFilters && <span style={{ fontSize: '11px', backgroundColor: '#2563eb', color: 'white', borderRadius: '10px', padding: '1px 6px' }}>!</span>}
          </button>

          {/* Export CSV */}
          <button onClick={() => { authApi.exportLogs(exportParams) }} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px',
            border: '1px solid #e5e7eb', backgroundColor: 'white',
            color: '#374151', fontSize: '13px', cursor: 'pointer', fontWeight: 500,
          }}>
            <Download size={14} /> Xuất CSV
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
            {/* Hành động */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Hành động</label>
              <div style={{ position: 'relative' }}>
                <select style={selectStyle} value={action} onChange={e => { setAction(e.target.value); handleFilterChange() }}>
                  <option value="">Tất cả</option>
                  {ACTIONS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
                <svg style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>

            {/* Module */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Module</label>
              <div style={{ position: 'relative' }}>
                <select style={selectStyle} value={module} onChange={e => { setModule(e.target.value); handleFilterChange() }}>
                  <option value="">Tất cả</option>
                  {Object.entries(MODULE_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <svg style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>

            {/* Trạng thái */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Trạng thái</label>
              <div style={{ position: 'relative' }}>
                <select style={selectStyle} value={status} onChange={e => { setStatus(e.target.value); handleFilterChange() }}>
                  <option value="">Tất cả</option>
                  <option value="SUCCESS">Thành công</option>
                  <option value="FAILED">Thất bại</option>
                </select>
                <svg style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>

            {/* Từ ngày */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Từ ngày</label>
              <input type="date" value={startDate}
                onChange={e => { setStartDate(e.target.value); handleFilterChange() }}
                style={{ ...selectStyle, paddingRight: '12px' }} />
            </div>

            {/* Đến ngày */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Đến ngày</label>
              <input type="date" value={endDate}
                onChange={e => { setEndDate(e.target.value); handleFilterChange() }}
                style={{ ...selectStyle, paddingRight: '12px' }} />
            </div>

            {hasFilters && (
              <button onClick={clearFilters} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '8px 12px', borderRadius: '8px', border: '1px solid #fca5a5',
                backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '12px', cursor: 'pointer',
              }}>
                <X size={12} /> Xóa bộ lọc
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table card */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Đang tải...</div>
        ) : isError ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ color: '#dc2626', fontWeight: 600, fontSize: '13px' }}>Không thể tải nhật ký.</p>
            <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px' }}>Vui lòng kiểm tra kết nối và thử lại.</p>
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  {['Thời gian', 'Hành động', 'Người dùng', 'Module', 'Trạng thái', 'Chi tiết'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap', borderBottom: '1px solid #f1f5f9' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                    Không tìm thấy dữ liệu phù hợp.
                  </td></tr>
                ) : logs.map((log: any) => {
                  const mod = MODULE_STYLE[log.module] ?? MODULE_STYLE.System
                  const isSuccess = log.status === 'SUCCESS'
                  const actionLabel = ACTION_LABEL[log.action] ?? log.action
                  return (
                    <tr key={log.id}
                      style={{ borderTop: '1px solid #f1f5f9' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>

                      {/* Thời gian */}
                      <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                        <p style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>
                          {new Date(log.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                        <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
                          {new Date(log.createdAt).toLocaleTimeString('vi-VN')}
                        </p>
                      </td>

                      {/* Hành động */}
                      <td style={{ padding: '13px 16px', fontSize: '13px', color: '#111827', fontWeight: 500 }}>
                        {actionLabel}
                      </td>

                      {/* Người dùng */}
                      <td style={{ padding: '13px 16px' }}>
                        {log.user ? (
                          <>
                            <p style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{log.user.email}</p>
                            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>{log.user.fullName}</p>
                          </>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#9ca3af' }}>—</span>
                        )}
                      </td>

                      {/* Module */}
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          display: 'inline-block', fontSize: '11px', fontWeight: 600,
                          padding: '3px 8px', borderRadius: '20px',
                          color: mod.color, backgroundColor: mod.bg,
                        }}>
                          {log.module ?? '—'}
                        </span>
                      </td>

                      {/* Trạng thái */}
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          display: 'inline-block', fontSize: '12px', fontWeight: 600,
                          padding: '4px 12px', borderRadius: '20px',
                          color: isSuccess ? '#16a34a' : '#dc2626',
                          backgroundColor: isSuccess ? '#dcfce7' : '#fef2f2',
                        }}>
                          {isSuccess ? 'Thành công' : 'Thất bại'}
                        </span>
                      </td>

                      {/* Chi tiết */}
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '12px', color: '#6b7280',
                            maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            display: 'block',
                          }} title={log.detail ?? ''}>
                            {log.detail ? (log.detail.length > 35 ? log.detail.slice(0, 35) + '…' : log.detail) : '—'}
                          </span>
                          <button onClick={() => setDetailLog(log)} title="Xem chi tiết" style={{
                            border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px', flexShrink: 0,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#2563eb')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
                            <Info size={15} />
                          </button>
                        </div>
                        {log.ip && (
                          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>IP: {log.ip}</p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #f1f5f9' }}>
                <p style={{ fontSize: '12px', color: '#6b7280' }}>
                  Trang <strong>{page}</strong>/{totalPages} · {total} bản ghi
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {/* First */}
                  <PageBtn onClick={() => setPage(1)} disabled={page === 1} label="«" />
                  <PageBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} label="‹" />

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                    return start + i
                  }).map(p => (
                    <button key={p} onClick={() => setPage(p)} style={{
                      width: '32px', height: '32px', borderRadius: '6px', fontSize: '13px',
                      border: `1px solid ${p === page ? '#2563eb' : '#e5e7eb'}`,
                      backgroundColor: p === page ? '#2563eb' : 'white',
                      color: p === page ? 'white' : '#374151',
                      cursor: 'pointer', fontWeight: p === page ? 600 : 400,
                    }}>{p}</button>
                  ))}

                  <PageBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} label="›" />
                  <PageBtn onClick={() => setPage(totalPages)} disabled={page === totalPages} label="»" />
                </div>
              </div>
            )}

            {/* Simple footer when no pagination */}
            {totalPages <= 1 && logs.length > 0 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9' }}>
                <p style={{ fontSize: '12px', color: '#6b7280' }}>
                  Trang 1/1 · {total} bản ghi
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail dialog */}
      {detailLog && <DetailDialog log={detailLog} onClose={() => setDetailLog(null)} />}
    </div>
  )
}

function PageBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '32px', height: '32px', borderRadius: '6px', fontSize: '13px',
      border: '1px solid #e5e7eb', backgroundColor: disabled ? '#f9fafb' : 'white',
      color: disabled ? '#d1d5db' : '#374151', cursor: disabled ? 'not-allowed' : 'pointer',
    }}>{label}</button>
  )
}
