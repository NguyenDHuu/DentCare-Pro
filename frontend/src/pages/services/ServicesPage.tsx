import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, NavLink } from 'react-router-dom'
import {
  Layers, ListChecks, Search, Plus, Eye, Pencil, Trash2, X,
  UserRound, Loader2, AlertTriangle, RefreshCw, ChevronDown,
} from 'lucide-react'
import { serviceApi } from '../../api/services.api'
import type { ServiceGroup, Doctor, GroupService, Service } from '../../api/services.api'

// ─── Constants ───────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  INACTIVE:     { label: 'Chưa hoạt động', color: '#6b7280', bg: '#f3f4f6' },
  ACTIVE:       { label: 'Hoạt động',      color: '#16a34a', bg: '#dcfce7' },
  SUSPENDED:    { label: 'Tạm dừng',       color: '#d97706', bg: '#fef3c7' },
  DISCONTINUED: { label: 'Ngừng sử dụng',  color: '#dc2626', bg: '#fee2e2' },
}

const TRANSITIONS: Record<string, { to: string; label: string; danger?: boolean }[]> = {
  INACTIVE:     [{ to: 'ACTIVE',       label: 'Kích hoạt' }],
  ACTIVE:       [{ to: 'SUSPENDED',    label: 'Tạm dừng' }, { to: 'DISCONTINUED', label: 'Ngừng sử dụng', danger: true }],
  SUSPENDED:    [{ to: 'ACTIVE',       label: 'Kích hoạt lại' }, { to: 'DISCONTINUED', label: 'Ngừng sử dụng', danger: true }],
  DISCONTINUED: [],
}

const btn = {
  base: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none' } as React.CSSProperties,
  primary: { backgroundColor: '#2563eb', color: 'white' } as React.CSSProperties,
  ghost:   { backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb' } as React.CSSProperties,
  danger:  { backgroundColor: '#dc2626', color: 'white' } as React.CSSProperties,
}

const DURATION_OPTIONS = [
  { value: 0,   label: 'Chưa cấu hình',       hint: '' },
  { value: 15,  label: '15 phút',              hint: 'Tư vấn, khám sơ bộ' },
  { value: 30,  label: '30 phút',              hint: 'Khám tổng quát' },
  { value: 45,  label: '45 phút',              hint: 'Trám răng' },
  { value: 60,  label: '60 phút',              hint: 'Nhổ răng, lấy cao răng' },
  { value: 75,  label: '75 phút',              hint: '' },
  { value: 90,  label: '90 phút',              hint: 'Điều trị tủy' },
  { value: 120, label: '120 phút',             hint: 'Ca điều trị phức tạp' },
]

function fmtDuration(d: number): string {
  if (!d || d === 0) return '—'
  const opt = DURATION_OPTIONS.find(o => o.value === d)
  return opt ? opt.label : `${d} phút`
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtNum(n: number) {
  return n.toLocaleString('vi-VN')
}

// ─── Toast ───────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      backgroundColor: type === 'success' ? '#22c55e' : '#ef4444',
      color: 'white', padding: '12px 20px', borderRadius: '10px',
      fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', gap: '10px',
    }}>
      {type === 'success' ? '✓' : '✕'} {msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.INACTIVE
  return (
    <span style={{ fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '99px', backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

// ─── Action button ────────────────────────────────────────────

function ActionBtn({ icon, title, color = '#6b7280', onClick, disabled }: { icon: React.ReactNode; title: string; color?: string; onClick: () => void; disabled?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: '32px', height: '32px', border: '1px solid #e5e7eb', borderRadius: '7px',
        background: hover && !disabled ? '#f9fafb' : 'white', cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? '#d1d5db' : color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
      {icon}
    </button>
  )
}

// ════════════════════════════════════════════════════════════
// UC08 — Service Groups Tab
// ════════════════════════════════════════════════════════════

function GroupFormModal({ mode, initial, doctors, onSave, onClose }: {
  mode: 'add' | 'edit'; initial?: ServiceGroup; doctors: Doctor[]
  onSave: (d: { name: string; description: string; doctorIds: number[] }) => Promise<void>; onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [selectedDoctors, setSelectedDoctors] = useState<number[]>(initial?.doctors.map(d => d.id) ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleDoctor = (id: number) =>
    setSelectedDoctors(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Tên nhóm không được để trống'); return }
    if (selectedDoctors.length === 0) { setError('Phải chọn ít nhất một bác sĩ đảm nhiệm'); return }
    setLoading(true); setError('')
    try { await onSave({ name: name.trim(), description: description.trim(), doctorIds: selectedDoctors }) }
    catch (err: any) { setError(err.response?.data?.message || 'Lỗi hệ thống'); setLoading(false) }
  }

  return (
    <Overlay>
      <ModalCard maxWidth={480}>
        <ModalHeader
          title={mode === 'add' ? 'Thêm nhóm dịch vụ mới' : 'Chỉnh sửa nhóm dịch vụ'}
          subtitle="Mỗi nhóm bắt buộc phải có ít nhất một bác sĩ đảm nhiệm (UC08)."
          onClose={onClose}
        />
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && <ErrorBanner msg={error} />}
            <Field label="Tên nhóm" required>
              <TextInput value={name} onChange={setName} placeholder="Ví dụ: Nha khoa tổng quát" autoFocus />
            </Field>
            <Field label="Mô tả">
              <TextInput value={description} onChange={setDescription} placeholder="Mô tả ngắn về nhóm..." />
            </Field>
            <Field label="Bác sĩ đảm nhiệm" required>
              <div style={{ border: '1.5px solid #e5e7eb', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {doctors.length === 0
                  ? <p style={{ padding: '16px', fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>Chưa có bác sĩ nào trong hệ thống</p>
                  : doctors.map(doc => (
                    <label key={doc.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer',
                      borderBottom: '1px solid #f3f4f6', backgroundColor: selectedDoctors.includes(doc.id) ? '#eff6ff' : 'transparent',
                    }}>
                      <input type="checkbox" checked={selectedDoctors.includes(doc.id)} onChange={() => toggleDoctor(doc.id)}
                        style={{ width: '15px', height: '15px', accentColor: '#2563eb', flexShrink: 0 }} />
                      <UserRound size={15} color="#6b7280" />
                      <span style={{ fontSize: '13px', color: '#374151' }}>BS. {doc.fullName}</span>
                    </label>
                  ))
                }
              </div>
              {selectedDoctors.length > 0 && (
                <p style={{ fontSize: '12px', color: '#2563eb', marginTop: '6px' }}>Đã chọn {selectedDoctors.length} bác sĩ</p>
              )}
            </Field>
          </div>
          <ModalFooter onClose={onClose} loading={loading} submitLabel={mode === 'add' ? 'Thêm nhóm' : 'Lưu thay đổi'} />
        </form>
      </ModalCard>
    </Overlay>
  )
}

function ViewServicesModal({ groupId, groupName, onClose }: { groupId: number; groupName: string; onClose: () => void }) {
  const [services, setServices] = useState<GroupService[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    serviceApi.getGroupServices(groupId).then(r => setServices(r.data.services)).catch(() => setServices([])).finally(() => setLoading(false))
  }, [groupId])

  return (
    <Overlay>
      <ModalCard maxWidth={480}>
        <ModalHeader title={`Dịch vụ trong nhóm: ${groupName}`} subtitle="Danh sách dịch vụ thuộc nhóm này." onClose={onClose} bordered />
        <div style={{ padding: '8px 0', maxHeight: '360px', overflowY: 'auto' }}>
          {loading
            ? <CenterLoader />
            : services.length === 0
              ? <EmptyMsg msg="Nhóm này chưa có dịch vụ nào." />
              : services.map(sv => (
                <div key={sv.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', borderBottom: '1px solid #f9fafb' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '2px 7px', borderRadius: '4px', flexShrink: 0 }}>{sv.code}</span>
                  <span style={{ flex: 1, fontSize: '14px', color: '#111827', fontWeight: 500 }}>{sv.name}</span>
                  <StatusBadge status={sv.status} />
                </div>
              ))
          }
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Đóng</button>
        </div>
      </ModalCard>
    </Overlay>
  )
}

function DeleteGroupModal({ groupName, loading, onConfirm, onClose }: { groupName: string; loading: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Overlay>
      <ModalCard maxWidth={380} style={{ padding: '28px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trash2 size={18} color="#dc2626" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>Xác nhận xóa nhóm</h3>
          </div>
          <CloseBtn onClose={onClose} />
        </div>
        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, marginBottom: '6px' }}>
          Bạn sắp xóa nhóm <strong style={{ color: '#111827' }}>{groupName}</strong>. Hành động này không thể hoàn tác.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <button onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Hủy</button>
          <button onClick={onConfirm} disabled={loading} style={{ ...btn.base, ...btn.danger, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Xác nhận xóa
          </button>
        </div>
      </ModalCard>
    </Overlay>
  )
}

function ServiceGroupsTab() {
  const [groups, setGroups] = useState<ServiceGroup[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ServiceGroup | null>(null)
  const [viewTarget, setViewTarget] = useState<ServiceGroup | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServiceGroup | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type })

  const loadGroups = async (q = search) => {
    setLoading(true)
    try { setGroups((await serviceApi.getGroups(q || undefined)).data) }
    catch { showToast('Không thể tải danh sách nhóm dịch vụ', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadGroups(); serviceApi.getDoctors().then(r => setDoctors(r.data)).catch(() => {}) }, [])

  const handleSearch = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { setSearch(searchInput); loadGroups(searchInput) } }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <SearchBox value={searchInput} onChange={setSearchInput} onKeyDown={handleSearch} placeholder="Tìm kiếm nhóm dịch vụ..." />
        <button onClick={() => setAddOpen(true)} style={{ ...btn.base, ...btn.primary }}><Plus size={15} /> Thêm nhóm</button>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <TableHeader cols={['2fr', '3fr', '120px', '120px']} labels={['Tên nhóm', 'Bác sĩ đảm nhiệm', 'Số dịch vụ', 'Thao tác']} lastRight />
        {loading ? <CenterLoader />
          : groups.length === 0 ? <EmptyMsg msg={search ? 'Không tìm thấy nhóm nào phù hợp.' : 'Chưa có nhóm dịch vụ nào.'} />
          : groups.map((g, i) => (
            <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 120px 120px', padding: '16px 20px', alignItems: 'center', borderBottom: i < groups.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{g.name}</p>
                {g.description && <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{g.description}</p>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {g.doctors.map(d => (
                  <span key={d.id} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '99px', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 500 }}>
                    BS. {d.fullName}
                  </span>
                ))}
              </div>
              <span style={{ fontSize: '14px', color: '#374151' }}>{g.serviceCount} <span style={{ color: '#9ca3af', fontSize: '12px' }}>dịch vụ</span></span>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                <ActionBtn icon={<Eye size={15} />} title="Xem dịch vụ" onClick={() => setViewTarget(g)} />
                <ActionBtn icon={<Pencil size={15} />} title="Chỉnh sửa" color="#2563eb" onClick={() => setEditTarget(g)} />
                <ActionBtn icon={<Trash2 size={15} />} title="Xóa" color="#dc2626" onClick={() => setDeleteTarget(g)} />
              </div>
            </div>
          ))
        }
      </div>

      {addOpen && <GroupFormModal mode="add" doctors={doctors} onSave={async d => { await serviceApi.createGroup(d); setAddOpen(false); showToast('Thêm nhóm thành công'); loadGroups() }} onClose={() => setAddOpen(false)} />}
      {editTarget && <GroupFormModal mode="edit" initial={editTarget} doctors={doctors} onSave={async d => { await serviceApi.updateGroup(editTarget.id, d); setEditTarget(null); showToast('Cập nhật nhóm thành công'); loadGroups() }} onClose={() => setEditTarget(null)} />}
      {viewTarget && <ViewServicesModal groupId={viewTarget.id} groupName={viewTarget.name} onClose={() => setViewTarget(null)} />}
      {deleteTarget && (
        <DeleteGroupModal groupName={deleteTarget.name} loading={deleteLoading} onClose={() => setDeleteTarget(null)} onConfirm={async () => {
          setDeleteLoading(true)
          try { await serviceApi.deleteGroup(deleteTarget.id); setDeleteTarget(null); showToast('Xóa nhóm thành công'); loadGroups() }
          catch (e: any) { showToast(e.response?.data?.message || 'Không thể xóa nhóm', 'error'); setDeleteTarget(null) }
          finally { setDeleteLoading(false) }
        }} />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// UC09 — Services Tab
// ════════════════════════════════════════════════════════════

function ServiceFormModal({ mode, initial, groups, onSave, onClose }: {
  mode: 'add' | 'edit'; initial?: Service; groups: ServiceGroup[]
  onSave: (d: { code: string; name: string; serviceGroupId: number; description: string; duration: number }) => Promise<void>
  onClose: () => void
}) {
  const [code,        setCode]        = useState(initial?.code        ?? '')
  const [name,        setName]        = useState(initial?.name        ?? '')
  const [groupId,     setGroupId]     = useState<number>(initial?.serviceGroupId ?? (groups[0]?.id ?? 0))
  const [description, setDescription] = useState(initial?.description ?? '')
  const [duration,    setDuration]    = useState<number>(initial?.duration ?? 0)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) { setError('Mã dịch vụ không được để trống'); return }
    if (!name.trim()) { setError('Tên dịch vụ không được để trống'); return }
    if (!groupId) { setError('Vui lòng chọn nhóm dịch vụ'); return }
    setLoading(true); setError('')
    try {
      await onSave({ code: code.trim(), name: name.trim(), serviceGroupId: groupId, description: description.trim(), duration })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi hệ thống'); setLoading(false)
    }
  }

  return (
    <Overlay>
      <ModalCard maxWidth={500}>
        <ModalHeader
          title={mode === 'add' ? 'Thêm dịch vụ mới' : 'Chỉnh sửa dịch vụ'}
          subtitle="Dịch vụ không bị xóa cứng; chỉ đổi trạng thái sang Ngừng sử dụng (UC09)."
          onClose={onClose}
        />
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && <ErrorBanner msg={error} />}

            {/* Mã + Tên */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
              <Field label="Mã dịch vụ" required>
                <TextInput value={code} onChange={setCode} placeholder="DV011" autoFocus />
              </Field>
              <Field label="Tên dịch vụ" required>
                <TextInput value={name} onChange={setName} placeholder="Tên dịch vụ..." />
              </Field>
            </div>

            {/* Nhóm dịch vụ */}
            <Field label="Nhóm dịch vụ" required>
              <div style={{ position: 'relative' }}>
                <select value={groupId} onChange={e => setGroupId(Number(e.target.value))} style={{
                  width: '100%', padding: '10px 36px 10px 12px', border: '1.5px solid #e5e7eb',
                  borderRadius: '8px', fontSize: '14px', outline: 'none',
                  appearance: 'none', backgroundColor: 'white', cursor: 'pointer', boxSizing: 'border-box',
                }}>
                  <option value={0} disabled>-- Chọn nhóm --</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <ChevronDown size={15} color="#9ca3af" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </Field>

            {/* Thời lượng thực hiện */}
            <Field label="Thời lượng thực hiện (phút)">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number" min={0} max={480} step={5}
                  value={duration || ''}
                  onChange={e => setDuration(Number(e.target.value) || 0)}
                  placeholder="0"
                  style={{
                    width: '120px', padding: '10px 12px', border: '1.5px solid #e5e7eb',
                    borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
                />
                <span style={{ fontSize: '13px', color: '#6b7280' }}>phút</span>
                {duration > 0 && (
                  <span style={{ fontSize: '12px', color: '#2563eb', backgroundColor: '#eff6ff', padding: '3px 10px', borderRadius: '99px', fontWeight: 600 }}>
                    {duration} phút / lịch hẹn
                  </span>
                )}
              </div>
              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '5px' }}>
                Để trống hoặc nhập 0 nếu chưa xác định. Dùng để tính slot khi đặt lịch hẹn.
              </p>
            </Field>

            {/* Mô tả */}
            <Field label="Mô tả">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Mô tả chi tiết về dịch vụ..."
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
                  borderRadius: '8px', fontSize: '14px', outline: 'none',
                  resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
              />
            </Field>
          </div>
          <ModalFooter onClose={onClose} loading={loading} submitLabel={mode === 'add' ? 'Thêm dịch vụ' : 'Lưu thay đổi'} />
        </form>
      </ModalCard>
    </Overlay>
  )
}

function ServiceDetailModal({ service, onClose }: { service: Service; onClose: () => void }) {
  const durOpt = DURATION_OPTIONS.find(o => o.value === service.duration)
  const durLabel = service.duration > 0
    ? `${service.duration} phút${durOpt?.hint ? ` — ${durOpt.hint}` : ''}`
    : 'Chưa cấu hình'

  const rows = [
    { label: 'Mã dịch vụ',     value: service.code },
    { label: 'Tên dịch vụ',    value: service.name },
    { label: 'Nhóm',           value: service.serviceGroup.name },
    { label: 'Thời lượng',     value: durLabel },
    { label: 'Mô tả',          value: service.description || '—' },
    { label: 'Ngày tạo',       value: fmtDate(service.createdAt) },
    { label: 'Ngày hoạt động', value: fmtDate(service.activatedAt) },
    { label: 'Lượt sử dụng',   value: fmtNum(service.usageCount) },
  ]
  return (
    <Overlay>
      <ModalCard maxWidth={480}>
        <ModalHeader title="Chi tiết dịch vụ" onClose={onClose} bordered />
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rows.map(r => (
            <div key={r.label} style={{ display: 'flex', gap: '16px' }}>
              <span style={{ width: '130px', flexShrink: 0, fontSize: '13px', color: '#9ca3af' }}>{r.label}</span>
              <span style={{ fontSize: '13px', color: '#111827', fontWeight: 500 }}>{r.value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '16px' }}>
            <span style={{ width: '130px', flexShrink: 0, fontSize: '13px', color: '#9ca3af' }}>Trạng thái</span>
            <StatusBadge status={service.status} />
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Đóng</button>
        </div>
      </ModalCard>
    </Overlay>
  )
}

function StatusDropdown({ service, onChanged, showToast }: { service: Service; onChanged: () => void; showToast: (msg: string, type: 'success' | 'error') => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const transitions = TRANSITIONS[service.status] ?? []

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      // Close only when clicking outside BOTH the trigger button AND the dropdown
      if (btnRef.current?.contains(e.target as Node)) return
      if (dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (transitions.length === 0) return (
    <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db' }}>
      <RefreshCw size={15} />
    </div>
  )

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen(o => !o)
  }

  const handleChange = async (to: string) => {
    setOpen(false)
    setLoading(true)
    try {
      await serviceApi.changeStatus(service.id, to)
      showToast('Đổi trạng thái thành công', 'success')
      onChanged()
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Không thể đổi trạng thái', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        title="Đổi trạng thái"
        onClick={handleOpen}
        disabled={loading}
        style={{
          width: '32px', height: '32px', border: '1px solid #e5e7eb', borderRadius: '7px',
          background: 'white', cursor: loading ? 'not-allowed' : 'pointer', color: '#6b7280',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={15} />}
      </button>

      {open && createPortal(
        <div ref={dropRef} style={{
          position: 'fixed', top: dropPos.top, right: dropPos.right,
          backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)', zIndex: 9999,
          minWidth: '170px', overflow: 'hidden',
        }}>
          {transitions.map(tr => (
            <button key={tr.to} onClick={() => handleChange(tr.to)}
              style={{
                width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none',
                background: 'none', cursor: 'pointer', fontSize: '13px',
                color: tr.danger ? '#dc2626' : '#374151',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = tr.danger ? '#fef2f2' : '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              → {tr.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

function DeleteServiceModal({ service, onConfirm, onClose }: {
  service: Service; onConfirm: () => Promise<void>; onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const canDelete = service.usageCount === 0

  const handleConfirm = async () => {
    setLoading(true); setError('')
    try { await onConfirm() }
    catch (e: any) { setError(e.response?.data?.message || 'Không thể xóa dịch vụ'); setLoading(false) }
  }

  return (
    <Overlay>
      <ModalCard maxWidth={400} style={{ padding: '28px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: canDelete ? '#fef2f2' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trash2 size={18} color={canDelete ? '#dc2626' : '#d97706'} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>
              {canDelete ? 'Xác nhận xóa dịch vụ' : 'Không thể xóa dịch vụ'}
            </h3>
          </div>
          <CloseBtn onClose={onClose} />
        </div>

        {canDelete ? (
          <>
            <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6 }}>
              Bạn sắp xóa dịch vụ <strong style={{ color: '#111827' }}>{service.code} – {service.name}</strong>.
              Hành động này <strong style={{ color: '#dc2626' }}>không thể hoàn tác</strong>.
            </p>
            {error && <div style={{ marginTop: '12px' }}><ErrorBanner msg={error} /></div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Hủy</button>
              <button onClick={handleConfirm} disabled={loading} style={{ ...btn.base, ...btn.danger, opacity: loading ? 0.7 : 1 }}>
                {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                Xác nhận xóa
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', color: '#92400e', margin: 0, lineHeight: 1.6 }}>
                Dịch vụ <strong>{service.code} – {service.name}</strong> đã có{' '}
                <strong>{fmtNum(service.usageCount)} lượt sử dụng</strong> nên không thể xóa.
              </p>
            </div>
            <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
              Nếu không muốn tiếp tục sử dụng, hãy chuyển trạng thái sang{' '}
              <strong style={{ color: '#dc2626' }}>Ngừng sử dụng</strong> thay thế.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Đóng</button>
            </div>
          </>
        )}
      </ModalCard>
    </Overlay>
  )
}

function ServicesListTab() {
  const [services, setServices] = useState<Service[]>([])
  const [groups, setGroups] = useState<ServiceGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState<number>(0)
  const [filterStatus, setFilterStatus] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Service | null>(null)
  const [viewTarget, setViewTarget] = useState<Service | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null)
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type })

  const ITEMS_PER_PAGE = 10

  const loadServices = async (q = search, gId = filterGroup, st = filterStatus) => {
    setLoading(true)
    try {
      const res = await serviceApi.getServices({
        search: q || undefined,
        groupId: gId || undefined,
        status: st || undefined,
      })
      setServices(res.data)
    } catch { showToast('Không thể tải danh sách dịch vụ', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    loadServices()
    serviceApi.getGroups().then(r => setGroups(r.data)).catch(() => {})
  }, [])

  const handleSearch = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { setSearch(searchInput); loadServices(searchInput, filterGroup, filterStatus) } }

  const handleGroupFilter = (v: number) => { setFilterGroup(v); setPage(1); loadServices(search, v, filterStatus) }
  const handleStatusFilter = (v: string) => { setFilterStatus(v); setPage(1); loadServices(search, filterGroup, v) }

  const totalPages = Math.ceil(services.length / ITEMS_PER_PAGE)
  const paginated = services.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  return (
    <div>
      {/* Status flow info */}
      <div style={{
        backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px',
        padding: '10px 16px', marginBottom: '16px', fontSize: '12px', color: '#1e40af',
      }}>
        <strong>Sơ đồ trạng thái: </strong>
        Chưa hoạt động → Hoạt động &nbsp;·&nbsp; Hoạt động → Tạm dừng &nbsp;·&nbsp; Tạm dừng → Hoạt động &nbsp;·&nbsp;
        Hoạt động/Tạm dừng → <span style={{ color: '#dc2626', fontWeight: 600 }}>Ngừng sử dụng (vĩnh viễn)</span>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
        <SearchBox value={searchInput} onChange={setSearchInput} onKeyDown={handleSearch} placeholder="Tìm theo mã / tên..." style={{ flex: 1, maxWidth: '300px' }} />

        {/* Group filter */}
        <div style={{ position: 'relative' }}>
          <select value={filterGroup} onChange={e => handleGroupFilter(Number(e.target.value))}
            style={{ padding: '9px 32px 9px 12px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', appearance: 'none', backgroundColor: 'white', cursor: 'pointer', outline: 'none', color: '#374151' }}>
            <option value={0}>Mọi nhóm</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <ChevronDown size={13} color="#9ca3af" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>

        {/* Status filter */}
        <div style={{ position: 'relative' }}>
          <select value={filterStatus} onChange={e => handleStatusFilter(e.target.value)}
            style={{ padding: '9px 32px 9px 12px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', appearance: 'none', backgroundColor: 'white', cursor: 'pointer', outline: 'none', color: '#374151' }}>
            <option value="">Mọi trạng thái</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <ChevronDown size={13} color="#9ca3af" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>

        <div style={{ flex: 1 }} />
        <button onClick={() => setAddOpen(true)} style={{ ...btn.base, ...btn.primary }}><Plus size={15} /> Thêm dịch vụ</button>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflowX: 'auto' }}>
        <div style={{ minWidth: '760px' }}>
        <div style={{ borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
          <TableHeader cols={['80px', '1fr', '140px', '90px', '80px', '140px', '148px']} labels={['Mã DV', 'Tên dịch vụ', 'Nhóm', 'Thời lượng', 'Lượt dùng', 'Trạng thái', 'Thao tác']} lastRight />
        </div>

        {loading ? <CenterLoader />
          : services.length === 0 ? <EmptyMsg msg="Không có dịch vụ nào phù hợp." />
          : paginated.map((sv, i) => (
            <div key={sv.id} style={{
              display: 'grid', gridTemplateColumns: '80px 1fr 140px 90px 80px 140px 148px',
              padding: '12px 20px', alignItems: 'center',
              borderBottom: i < paginated.length - 1 ? '1px solid #f3f4f6' : 'none',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', backgroundColor: '#f3f4f6', padding: '3px 8px', borderRadius: '5px', letterSpacing: '0.03em', display: 'inline-block' }}>
                {sv.code}
              </span>
              <div style={{ paddingRight: '12px' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{sv.name}</p>
                {sv.description && (
                  <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>
                    {sv.description}
                  </p>
                )}
              </div>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>{sv.serviceGroup.name}</span>
              <span style={{
                fontSize: '12px', fontWeight: 600,
                color: sv.duration > 0 ? '#2563eb' : '#d1d5db',
                backgroundColor: sv.duration > 0 ? '#eff6ff' : '#f9fafb',
                padding: '3px 8px', borderRadius: '6px', display: 'inline-block',
              }}>
                {fmtDuration(sv.duration)}
              </span>
              <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{fmtNum(sv.usageCount)}</span>
              <StatusBadge status={sv.status} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                <ActionBtn icon={<Eye size={15} />} title="Chi tiết" onClick={() => setViewTarget(sv)} />
                <ActionBtn icon={<Pencil size={15} />} title="Chỉnh sửa" color="#2563eb"
                  disabled={sv.status === 'DISCONTINUED'} onClick={() => setEditTarget(sv)} />
                <StatusDropdown service={sv} onChanged={loadServices} showToast={showToast} />
                <ActionBtn icon={<Trash2 size={15} />} title={sv.usageCount > 0 ? `Không thể xóa (${fmtNum(sv.usageCount)} lượt dùng)` : 'Xóa dịch vụ'}
                  color="#dc2626" onClick={() => setDeleteTarget(sv)} />
              </div>
            </div>
          ))
        }
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            Hiển thị {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, services.length)} / {services.length} dịch vụ
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <PageBtn label="«" disabled={page === 1} onClick={() => setPage(1)} />
            <PageBtn label="‹" disabled={page === 1} onClick={() => setPage(p => p - 1)} />
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '...'
                  ? <span key={`e${i}`} style={{ padding: '0 6px', lineHeight: '32px', color: '#9ca3af', fontSize: '13px' }}>…</span>
                  : <PageBtn key={p} label={String(p)} active={page === p} onClick={() => setPage(p as number)} />
              )
            }
            <PageBtn label="›" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} />
            <PageBtn label="»" disabled={page === totalPages} onClick={() => setPage(totalPages)} />
          </div>
        </div>
      )}

      {addOpen && (
        <ServiceFormModal mode="add" groups={groups} onClose={() => setAddOpen(false)} onSave={async d => {
          await serviceApi.createService(d); setAddOpen(false); showToast('Thêm dịch vụ thành công'); loadServices()
        }} />
      )}
      {editTarget && (
        <ServiceFormModal mode="edit" initial={editTarget} groups={groups} onClose={() => setEditTarget(null)} onSave={async d => {
          await serviceApi.updateService(editTarget.id, d); setEditTarget(null); showToast('Cập nhật dịch vụ thành công'); loadServices()
        }} />
      )}
      {viewTarget && <ServiceDetailModal service={viewTarget} onClose={() => setViewTarget(null)} />}
      {deleteTarget && (
        <DeleteServiceModal
          service={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await serviceApi.deleteService(deleteTarget.id)
            setDeleteTarget(null)
            showToast('Xóa dịch vụ thành công')
            loadServices()
          }}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// Shared UI primitives
// ════════════════════════════════════════════════════════════

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      {children}
    </div>
  )
}

function ModalCard({ children, maxWidth, style }: { children: React.ReactNode; maxWidth: number; style?: React.CSSProperties }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', ...style }}>
      {children}
    </div>
  )
}

function ModalHeader({ title, subtitle, onClose, bordered }: { title: string; subtitle?: string; onClose: () => void; bordered?: boolean }) {
  return (
    <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', ...(bordered ? { borderBottom: '1px solid #f3f4f6', paddingBottom: '16px' } : {}) }}>
      <div>
        <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{subtitle}</p>}
      </div>
      <CloseBtn onClose={onClose} />
    </div>
  )
}

function ModalFooter({ onClose, loading, submitLabel }: { onClose: () => void; loading: boolean; submitLabel: string }) {
  return (
    <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
      <button type="button" onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Hủy</button>
      <button type="submit" disabled={loading} style={{ ...btn.base, ...btn.primary, opacity: loading ? 0.7 : 1 }}>
        {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
        {submitLabel}
      </button>
    </div>
  )
}

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', flexShrink: 0 }}><X size={18} /></button>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
      style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
      onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
      onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
    />
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <AlertTriangle size={15} /> {msg}
    </div>
  )
}

function SearchBox({ value, onChange, onKeyDown, placeholder, style }: { value: string; onChange: (v: string) => void; onKeyDown?: (e: React.KeyboardEvent) => void; placeholder?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ position: 'relative', width: '280px', ...style }}>
      <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
      <input value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
        onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
        onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
      />
    </div>
  )
}

function TableHeader({ cols, labels, lastRight }: { cols: string[]; labels: string[]; lastRight?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols.join(' '), padding: '12px 20px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {labels.map((l, i) => <span key={l} style={lastRight && i === labels.length - 1 ? { textAlign: 'right' } : {}}>{l}</span>)}
    </div>
  )
}

function PageBtn({ label, active, disabled, onClick }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: '32px', height: '32px', border: '1px solid #e5e7eb', borderRadius: '7px',
        fontSize: '13px', fontWeight: active ? 700 : 400, cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: active ? '#2563eb' : 'white',
        color: active ? 'white' : disabled ? '#d1d5db' : '#374151',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      {label}
    </button>
  )
}

function CenterLoader() {
  return <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}><Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} /></div>
}

function EmptyMsg({ msg }: { msg: string }) {
  return <p style={{ textAlign: 'center', padding: '48px', fontSize: '14px', color: '#9ca3af' }}>{msg}</p>
}

// ════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════

function TabLink({ to, active, icon, label }: { to: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <NavLink to={to} style={{
      display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 16px',
      fontSize: '13px', fontWeight: active ? 700 : 500, color: active ? '#2563eb' : '#6b7280',
      textDecoration: 'none', borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
      marginBottom: '-1px', transition: 'color 0.15s',
    }}>
      {icon} {label}
    </NavLink>
  )
}

export default function ServicesPage() {
  const location = useLocation()
  const isGroupsTab = location.pathname === '/services/groups'

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
        <TabLink to="/services/groups" active={isGroupsTab} icon={<Layers size={15} />} label="Nhóm dịch vụ" />
        <TabLink to="/services" active={!isGroupsTab} icon={<ListChecks size={15} />} label="Các dịch vụ" />
      </div>
      {isGroupsTab ? <ServiceGroupsTab /> : <ServicesListTab />}
    </div>
  )
}
