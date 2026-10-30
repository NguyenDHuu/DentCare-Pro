import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User, Mail, Phone, MapPin, Calendar, Shield, Briefcase, Clock,
  Wallet, KeyRound, FileText, Camera, Save, X, ChevronDown,
  Building2, Globe, Award, BookOpen, CreditCard, Lock,
  CheckCircle, AlertCircle, Activity, Upload, Loader2, Construction,
} from 'lucide-react'
import { profileApi, type UpdateProfilePayload, type AdminProfileData } from '../../api/profile.api'
import { useAuthStore } from '../../stores/auth.store'

// ─── Constants ────────────────────────────────────────────────

const TABS = [
  { key: 'personal',     label: 'Thông tin cá nhân', icon: User },
  { key: 'professional', label: 'Chuyên môn',         icon: Award },
  { key: 'employment',   label: 'Công việc',           icon: Briefcase },
  { key: 'schedule',     label: 'Lịch làm việc',       icon: Clock },
  { key: 'salary',       label: 'Tài chính',           icon: Wallet },
  { key: 'account',      label: 'Tài khoản',           icon: KeyRound },
  { key: 'documents',    label: 'Hồ sơ đính kèm',     icon: FileText },
]

const EMPLOYMENT_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  working:  { label: 'Đang làm',          color: '#16a34a', bg: '#dcfce7' },
  on_leave: { label: 'Nghỉ phép',         color: '#d97706', bg: '#fef3c7' },
  resigned: { label: 'Đã nghỉ',           color: '#dc2626', bg: '#fee2e2' },
  inactive: { label: 'Không hoạt động',   color: '#6b7280', bg: '#f3f4f6' },
}

const ACCOUNT_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: 'Hoạt động',         color: '#16a34a', bg: '#dcfce7' },
  locked:   { label: 'Bị khóa',           color: '#dc2626', bg: '#fee2e2' },
  inactive: { label: 'Không hoạt động',   color: '#6b7280', bg: '#f3f4f6' },
}

const WORK_DAYS = [
  { key: 'Mon', label: 'T2' }, { key: 'Tue', label: 'T3' },
  { key: 'Wed', label: 'T4' }, { key: 'Thu', label: 'T5' },
  { key: 'Fri', label: 'T6' }, { key: 'Sat', label: 'T7' },
  { key: 'Sun', label: 'CN' },
]

// ─── Helpers ──────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('vi-VN')
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('vi-VN')
}
function toDateInput(d: string | null | undefined) {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}
function str(v: any): string { return v ?? '' }
function arr(v: any): string[] { return Array.isArray(v) ? v : [] }

// ─── UI primitives ────────────────────────────────────────────

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ width: '32px', height: '32px', backgroundColor: '#eff6ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={16} color="#2563eb" />
      </div>
      <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{title}</span>
    </div>
  )
}

function Field({ label, children, span2 }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div style={{ gridColumn: span2 ? 'span 2' : 'span 1' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function InputText({
  value, onChange, placeholder = '', disabled = false, icon: Icon, type = 'text',
}: {
  value: string; onChange?: (v: string) => void; placeholder?: string
  disabled?: boolean; icon?: any; type?: string
}) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && <Icon size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />}
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%', height: '38px', padding: Icon ? '0 12px 0 32px' : '0 12px',
          borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px',
          color: disabled ? '#9ca3af' : '#111827', backgroundColor: disabled ? '#f9fafb' : 'white',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

function InputSelect({ value, onChange, options, disabled = false }: {
  value: string; onChange?: (v: string) => void
  options: { value: string; label: string }[]; disabled?: boolean
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%', height: '38px', padding: '0 32px 0 12px',
          borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px',
          color: value ? '#111827' : '#9ca3af',
          backgroundColor: disabled ? '#f9fafb' : 'white',
          outline: 'none', appearance: 'none',
          cursor: disabled ? 'default' : 'pointer', boxSizing: 'border-box',
        }}
      >
        <option value="">— Chọn —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} color="#9ca3af" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>
  )
}

function InputTextarea({ value, onChange, placeholder = '', rows = 3 }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', color: '#111827', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
    />
  )
}

function TagInput({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')
  const add = () => {
    if (!input.trim() || items.includes(input.trim())) return
    onChange([...items, input.trim()])
    setInput('')
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', minHeight: '42px', alignItems: 'center' }}>
      {items.map((s, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500, padding: '3px 8px', borderRadius: '20px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
          {s}
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#2563eb', lineHeight: 1 }}>
            <X size={11} />
          </button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        placeholder={items.length === 0 ? 'Nhập rồi Enter để thêm...' : ''}
        style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#374151', minWidth: '140px', flex: 1 }}
      />
    </div>
  )
}

function Badge({ value, map }: { value: string; map: Record<string, { label: string; color: string; bg: string }> }) {
  const cfg = map[value] ?? { label: value, color: '#6b7280', bg: '#f3f4f6' }
  return (
    <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '20px', color: cfg.color, backgroundColor: cfg.bg }}>
      {cfg.label}
    </span>
  )
}

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      backgroundColor: type === 'success' ? '#22c55e' : '#ef4444',
      color: 'white', padding: '12px 20px', borderRadius: '10px',
      fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', gap: '10px', animation: 'none',
    }}>
      {type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
        <X size={14} />
      </button>
    </div>
  )
}

// Banner "đang phát triển"
function ComingSoonBanner({ feature }: { feature: string }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9ca3af' }}>
      <div style={{ width: '56px', height: '56px', backgroundColor: '#fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Construction size={28} color="#d97706" />
      </div>
      <p style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
        {feature} — Đang phát triển
      </p>
      <p style={{ fontSize: '13px', color: '#9ca3af' }}>
        Tính năng này sẽ sớm được ra mắt. Các trường dữ liệu đã được chuẩn bị sẵn sàng.
      </p>
    </div>
  )
}

// ─── Tab panels ───────────────────────────────────────────────

function TabPersonal({ form, setForm }: { form: UpdateProfilePayload; setForm: (f: UpdateProfilePayload) => void }) {
  const set = (key: keyof UpdateProfilePayload) => (v: any) => setForm({ ...form, [key]: v })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <SectionTitle icon={User} title="Thông tin định danh" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Field label="Họ và tên">
            <InputText value={str(form.fullName)} onChange={set('fullName')} icon={User} placeholder="Nhập họ và tên" />
          </Field>
          <Field label="Giới tính">
            <InputSelect value={str(form.gender)} onChange={set('gender')} options={[
              { value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }, { value: 'other', label: 'Khác' },
            ]} />
          </Field>
          <Field label="Ngày sinh">
            <InputText value={str(form.dateOfBirth)} onChange={set('dateOfBirth')} type="date" icon={Calendar} />
          </Field>
          <Field label="Số điện thoại">
            <InputText value={str(form.phone)} onChange={set('phone')} icon={Phone} placeholder="VD: 0901234567" />
          </Field>
          <Field label="Địa chỉ liên hệ" span2>
            <InputText value={str(form.address)} onChange={set('address')} icon={MapPin} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" />
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle icon={FileText} title="Thông tin hành chính" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Field label="Số CCCD / CMND">
            <InputText value={str(form.nationalId)} onChange={set('nationalId')} icon={CreditCard} placeholder="12 chữ số" />
          </Field>
          <Field label="Ngày cấp">
            <InputText value={str(form.issueDate)} onChange={set('issueDate')} type="date" icon={Calendar} />
          </Field>
          <Field label="Nơi cấp">
            <InputText value={str(form.issuePlace)} onChange={set('issuePlace')} icon={MapPin} placeholder="VD: Công an TP.HCM" />
          </Field>
          <Field label="Quê quán">
            <InputText value={str(form.hometown)} onChange={set('hometown')} icon={MapPin} placeholder="VD: Bình Dương" />
          </Field>
          <Field label="Tình trạng hôn nhân">
            <InputSelect value={str(form.maritalStatus)} onChange={set('maritalStatus')} options={[
              { value: 'single',   label: 'Độc thân' }, { value: 'married',  label: 'Đã kết hôn' },
              { value: 'divorced', label: 'Ly hôn' },   { value: 'widowed',  label: 'Góa' },
              { value: 'other',    label: 'Khác' },
            ]} />
          </Field>
          <Field label="Người liên hệ khẩn cấp">
            <InputText value={str(form.emergencyContactName)} onChange={set('emergencyContactName')} icon={User} placeholder="Họ tên người liên hệ" />
          </Field>
          <Field label="SĐT khẩn cấp">
            <InputText value={str(form.emergencyContactPhone)} onChange={set('emergencyContactPhone')} icon={Phone} placeholder="VD: 0912345678" />
          </Field>
          <Field label="Ghi chú" span2>
            <InputTextarea value={str(form.notes)} onChange={set('notes')} placeholder="Ghi chú thêm về hồ sơ..." />
          </Field>
        </div>
      </div>
    </div>
  )
}

function TabProfessional({ form, setForm }: { form: UpdateProfilePayload; setForm: (f: UpdateProfilePayload) => void }) {
  const set = (key: keyof UpdateProfilePayload) => (v: any) => setForm({ ...form, [key]: v })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <SectionTitle icon={BookOpen} title="Trình độ học vấn & Chứng chỉ" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Field label="Chuyên ngành / Lĩnh vực">
            <InputText value={str(form.specialization)} onChange={set('specialization')} icon={Award} placeholder="VD: Quản trị hệ thống" />
          </Field>
          <Field label="Học vị / Chứng chỉ">
            <InputText value={str(form.degree)} onChange={set('degree')} icon={Award} placeholder="VD: Kỹ sư CNTT" />
          </Field>
          <Field label="Trình độ học vấn">
            <InputSelect value={str(form.educationLevel)} onChange={set('educationLevel')} options={[
              { value: 'Trung cấp', label: 'Trung cấp' }, { value: 'Cao đẳng', label: 'Cao đẳng' },
              { value: 'Đại học',   label: 'Đại học' },   { value: 'Thạc sĩ',  label: 'Thạc sĩ' },
              { value: 'Tiến sĩ',  label: 'Tiến sĩ' },
            ]} />
          </Field>
          <Field label="Trường tốt nghiệp">
            <InputText value={str(form.graduatedSchool)} onChange={set('graduatedSchool')} icon={BookOpen} placeholder="VD: ĐH Bách Khoa TP.HCM" />
          </Field>
          <Field label="Năm tốt nghiệp">
            <InputText value={form.graduationYear != null ? String(form.graduationYear) : ''}
              onChange={v => set('graduationYear')(v ? Number(v) : null)} placeholder="VD: 2012" />
          </Field>
          <Field label="Số năm kinh nghiệm">
            <InputText value={form.yearsOfExperience != null ? String(form.yearsOfExperience) : ''}
              onChange={v => set('yearsOfExperience')(v ? Number(v) : null)} placeholder="VD: 5" />
          </Field>
          <Field label="Số chứng chỉ hành nghề">
            <InputText value={str(form.certificateNumber)} onChange={set('certificateNumber')} icon={FileText} placeholder="Số chứng chỉ" />
          </Field>
          <Field label="Ngày cấp chứng chỉ">
            <InputText value={str(form.certificateIssueDate)} onChange={set('certificateIssueDate')} type="date" icon={Calendar} />
          </Field>
          <Field label="Ngày hết hạn chứng chỉ">
            <InputText value={str(form.certificateExpiryDate)} onChange={set('certificateExpiryDate')} type="date" icon={Calendar} />
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle icon={Shield} title="Kỹ năng & Quyền hệ thống" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Field label="Kỹ năng chuyên môn">
            <TagInput items={arr(form.professionalSkills)} onChange={v => set('professionalSkills')(v)} />
          </Field>
          <Field label="Quyền hệ thống">
            <div style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
              {arr(form.systemPermissions).length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {arr(form.systemPermissions).map((p, i) => (
                    <span key={i} style={{ fontSize: '12px', fontWeight: 500, padding: '3px 10px', borderRadius: '20px', backgroundColor: '#fef3c7', color: '#d97706' }}>{p}</span>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: '13px', color: '#9ca3af' }}>Chưa có quyền hệ thống nào được gán.</span>
              )}
              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>* Quyền hệ thống được quản lý bởi Super Admin.</p>
            </div>
          </Field>
          <Field label="Ngôn ngữ">
            <TagInput items={arr(form.languages)} onChange={v => set('languages')(v)} />
          </Field>
        </div>
      </div>
    </div>
  )
}

function TabEmployment({ form, setForm }: { form: UpdateProfilePayload; setForm: (f: UpdateProfilePayload) => void }) {
  const set = (key: keyof UpdateProfilePayload) => (v: any) => setForm({ ...form, [key]: v })
  return (
    <div>
      <SectionTitle icon={Briefcase} title="Thông tin công việc" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Field label="Trạng thái làm việc">
          <InputSelect value={str(form.employmentStatus)} onChange={set('employmentStatus')} options={[
            { value: 'working',  label: 'Đang làm' },   { value: 'on_leave', label: 'Nghỉ phép' },
            { value: 'resigned', label: 'Đã nghỉ' },    { value: 'inactive', label: 'Không hoạt động' },
          ]} />
        </Field>
        <Field label="Chức vụ / Vị trí">
          <InputText value={str(form.position)} onChange={set('position')} icon={Briefcase} placeholder="VD: Admin, Manager" />
        </Field>
        <Field label="Phòng ban">
          <InputText value={str(form.department)} onChange={set('department')} icon={Building2} placeholder="VD: Ban Quản trị" />
        </Field>
        <Field label="Chi nhánh">
          <InputText value={str(form.branch)} onChange={set('branch')} icon={Building2} placeholder="VD: Chi nhánh Quận 5" />
        </Field>
        <Field label="Loại hình công việc">
          <InputSelect value={str(form.workType)} onChange={set('workType')} options={[
            { value: 'full_time',    label: 'Toàn thời gian' },
            { value: 'part_time',    label: 'Bán thời gian' },
            { value: 'collaborator', label: 'Cộng tác viên' },
          ]} />
        </Field>
        <Field label="Số hợp đồng lao động">
          <InputText value={str(form.contractNumber)} onChange={set('contractNumber')} icon={FileText} placeholder="VD: HD-2023-001" />
        </Field>
        <Field label="Ngày vào làm">
          <InputText value={str(form.startDate)} onChange={set('startDate')} type="date" icon={Calendar} />
        </Field>
        <Field label="Ngày nghỉ việc">
          <InputText value={str(form.endDate)} onChange={set('endDate')} type="date" icon={Calendar} />
        </Field>
        <Field label="Ghi chú công việc" span2>
          <InputTextarea value={str(form.workingNote)} onChange={set('workingNote')} placeholder="Ghi chú về công việc..." />
        </Field>
      </div>
    </div>
  )
}

function TabAccount({ data }: { data: AdminProfileData }) {
  const roles = data.roles.map(r => r.role.name)
  const accountStatus = data.isActive ? 'active' : 'locked'

  return (
    <div>
      <SectionTitle icon={KeyRound} title="Thông tin tài khoản hệ thống" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Field label="Tên đăng nhập">
          <InputText value={data.username} disabled icon={User} />
        </Field>
        <Field label="Vai trò">
          <div style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {roles.map(r => (
              <span key={r} style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '20px', color: '#2563eb', backgroundColor: '#eff6ff' }}>
                {r}
              </span>
            ))}
          </div>
        </Field>
        <Field label="Trạng thái tài khoản">
          <div style={{ height: '38px', display: 'flex', alignItems: 'center' }}>
            <Badge value={accountStatus} map={ACCOUNT_STATUS_MAP} />
          </div>
        </Field>
        <Field label="Địa chỉ Email">
          <InputText value={data.email} disabled icon={Mail} />
        </Field>
        <Field label="Ngày tạo tài khoản">
          <InputText value={fmtDateTime(data.createdAt)} disabled icon={Calendar} />
        </Field>
        <Field label="Cập nhật lần cuối">
          <InputText value={fmtDateTime(data.updatedAt)} disabled icon={Calendar} />
        </Field>
      </div>

      <div style={{ marginTop: '20px', padding: '14px 16px', backgroundColor: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <Lock size={14} color="#d97706" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#d97706' }}>Bảo mật tài khoản</span>
        </div>
        <p style={{ fontSize: '12px', color: '#92400e' }}>
          Để đổi mật khẩu, vui lòng vào mục <strong>Đổi mật khẩu</strong> trong menu người dùng.
          Mật khẩu được mã hóa và không hiển thị ở đây.
        </p>
      </div>
    </div>
  )
}

function TabDocuments({ form, setForm }: { form: UpdateProfilePayload; setForm: (f: UpdateProfilePayload) => void }) {
  const docGroups: { key: keyof UpdateProfilePayload; label: string; desc: string; color: string; bg: string }[] = [
    { key: 'qualificationFiles', label: 'Bằng cấp / Chứng chỉ', desc: 'Upload ảnh hoặc PDF các bằng cấp, chứng chỉ', color: '#2563eb', bg: '#eff6ff' },
    { key: 'identityFiles',      label: 'CCCD / CMND',          desc: 'Upload ảnh mặt trước và mặt sau CCCD/CMND',  color: '#16a34a', bg: '#dcfce7' },
    { key: 'contractFiles',      label: 'Hợp đồng lao động',    desc: 'Upload hợp đồng lao động đã ký',              color: '#7c3aed', bg: '#f5f3ff' },
    { key: 'profileDocuments',   label: 'Tài liệu khác',        desc: 'Các tài liệu bổ sung liên quan đến hồ sơ',    color: '#d97706', bg: '#fef3c7' },
  ]
  return (
    <div>
      <SectionTitle icon={FileText} title="Hồ sơ đính kèm" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {docGroups.map(g => {
          const files = arr((form as any)[g.key])
          return (
            <div key={g.key} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: g.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={14} color={g.color} />
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{g.label}</p>
                  <p style={{ fontSize: '11px', color: '#9ca3af' }}>{g.desc}</p>
                </div>
              </div>
              {files.length === 0 ? (
                <div style={{ border: '2px dashed #e5e7eb', borderRadius: '8px', padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
                  <Upload size={20} style={{ margin: '0 auto 6px' }} />
                  <p style={{ fontSize: '12px' }}>Chưa có tài liệu</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {files.map((f: string, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                      <button onClick={() => setForm({ ...form, [g.key]: files.filter((_: any, j: number) => j !== i) })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '8px', border: `1px dashed ${g.color}`, backgroundColor: 'transparent', color: g.color, fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                <Upload size={13} /> Tải lên tài liệu
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

function buildForm(data: AdminProfileData): UpdateProfilePayload {
  const p = data.adminProfile
  return {
    fullName:               data.fullName,
    phone:                  str(p?.phone),
    gender:                 str(p?.gender),
    dateOfBirth:            toDateInput(p?.dateOfBirth),
    address:                str(p?.address),
    nationalId:             str(p?.nationalId),
    issueDate:              toDateInput(p?.issueDate),
    issuePlace:             str(p?.issuePlace),
    hometown:               str(p?.hometown),
    maritalStatus:          str(p?.maritalStatus),
    emergencyContactName:   str(p?.emergencyContactName),
    emergencyContactPhone:  str(p?.emergencyContactPhone),
    notes:                  str(p?.notes),
    specialization:         str(p?.specialization),
    degree:                 str(p?.degree),
    educationLevel:         str(p?.educationLevel),
    graduatedSchool:        str(p?.graduatedSchool),
    graduationYear:         p?.graduationYear ?? null,
    certificateNumber:      str(p?.certificateNumber),
    certificateIssueDate:   toDateInput(p?.certificateIssueDate),
    certificateExpiryDate:  toDateInput(p?.certificateExpiryDate),
    yearsOfExperience:      p?.yearsOfExperience ?? null,
    professionalSkills:     arr(p?.professionalSkills),
    systemPermissions:      arr(p?.systemPermissions),
    languages:              arr(p?.languages),
    employmentStatus:       str(p?.employmentStatus),
    position:               str(p?.position),
    department:             str(p?.department),
    branch:                 str(p?.branch),
    workType:               str(p?.workType),
    startDate:              toDateInput(p?.startDate),
    endDate:                toDateInput(p?.endDate),
    contractNumber:         str(p?.contractNumber),
    workingNote:            str(p?.workingNote),
    qualificationFiles:     arr(p?.qualificationFiles),
    identityFiles:          arr(p?.identityFiles),
    contractFiles:          arr(p?.contractFiles),
    profileDocuments:       arr(p?.profileDocuments),
  }
}

export default function ProfilePage() {
  const { user: authUser } = useAuthStore()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('personal')
  const [form, setForm] = useState<UpdateProfilePayload>({})
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const initialFormRef = useRef<UpdateProfilePayload>({})

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => profileApi.getMyProfile().then(r => r.data),
    onSuccess: (d: AdminProfileData) => {
      const f = buildForm(d)
      setForm(f)
      initialFormRef.current = f
      setDirty(false)
    },
  } as any)

  const mutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) => profileApi.updateMyProfile(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-profile'] })
      setDirty(false)
      setToast({ msg: 'Lưu thay đổi thành công!', type: 'success' })
      setTimeout(() => setToast(null), 3000)
    },
    onError: () => {
      setToast({ msg: 'Có lỗi xảy ra, vui lòng thử lại.', type: 'error' })
      setTimeout(() => setToast(null), 3000)
    },
  })

  const handleChange = useCallback((f: UpdateProfilePayload) => {
    setForm(f)
    setDirty(true)
  }, [])

  const handleSave = () => mutation.mutate(form)

  const handleCancel = () => {
    setForm(initialFormRef.current)
    setDirty(false)
  }

  // Loading state
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '12px', color: '#9ca3af' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: '14px' }}>Đang tải hồ sơ...</span>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>
        <AlertCircle size={36} style={{ margin: '0 auto 12px', color: '#dc2626' }} />
        <p style={{ fontSize: '14px', color: '#374151', fontWeight: 600 }}>Không thể tải hồ sơ cá nhân.</p>
        <p style={{ fontSize: '13px', marginTop: '4px' }}>Vui lòng kiểm tra kết nối và thử lại.</p>
        <button onClick={() => qc.invalidateQueries({ queryKey: ['my-profile'] })}
          style={{ marginTop: '16px', padding: '8px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '13px' }}>
          Thử lại
        </button>
      </div>
    )
  }

  const p = data.adminProfile
  const roles = data.roles.map((r: any) => r.role.name)
  const employStatus = p?.employmentStatus ? EMPLOYMENT_STATUS_MAP[p.employmentStatus] : null

  const NODATA = '—'
  const noSave = activeTab === 'account' || activeTab === 'schedule' || activeTab === 'salary'

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

      {/* ── Left panel ── */}
      <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Profile card */}
        <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ height: '90px', background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #60a5fa 100%)' }} />
          <div style={{ padding: '0 20px 20px', position: 'relative' }}>
            <div style={{ position: 'relative', width: '72px', marginTop: '-36px', marginBottom: '12px' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#2563eb', border: '3px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 700, color: 'white' }}>
                {data.fullName.charAt(0)}
              </div>
              <button onClick={() => fileRef.current?.click()}
                style={{ position: 'absolute', bottom: 0, right: 0, width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#1e3a8a', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Camera size={11} color="white" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} />
            </div>

            <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{data.fullName}</p>
            <p style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600, marginTop: '2px' }}>
              {p?.position || roles.join(', ')}
            </p>

            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { icon: Shield,    value: roles.join(', ') },
                { icon: Building2, value: p?.department || NODATA },
                { icon: Calendar,  value: p?.startDate ? `Từ ${fmtDate(p.startDate)}` : NODATA },
                { icon: Mail,      value: data.email },
                { icon: Phone,     value: p?.phone || NODATA },
              ].map(({ icon: Icon, value }, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon size={13} color="#9ca3af" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                </div>
              ))}
            </div>

            {employStatus && (
              <div style={{ marginTop: '14px' }}>
                <Badge value={p!.employmentStatus!} map={EMPLOYMENT_STATUS_MAP} />
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Activity size={15} color="#2563eb" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>Hoạt động gần đây</span>
          </div>
          {data.logs.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>Chưa có hoạt động nào.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.logs.map((log: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', marginTop: '4px', flexShrink: 0, backgroundColor: log.status === 'SUCCESS' ? '#22c55e' : '#f87171' }} />
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 500, color: '#111827' }}>{log.action.replace(/_/g, ' ')}</p>
                    {log.detail && <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>{log.detail}</p>}
                    <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      {fmtDateTime(log.createdAt)}{log.ip ? ` · ${log.ip}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', overflowX: 'auto', padding: '0 4px' }}>
            {TABS.map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              const isDevTab = tab.key === 'schedule' || tab.key === 'salary'
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '14px 16px',
                  fontSize: '13px', whiteSpace: 'nowrap',
                  fontWeight: active ? 600 : 400,
                  color: active ? '#2563eb' : isDevTab ? '#d97706' : '#6b7280',
                  border: 'none', borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                  background: 'none', cursor: 'pointer', marginBottom: '-1px',
                }}>
                  <Icon size={14} />
                  {tab.label}
                  {isDevTab && <span style={{ fontSize: '10px', backgroundColor: '#fef3c7', color: '#d97706', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>Beta</span>}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div style={{ padding: '24px' }}>
            {activeTab === 'personal'     && <TabPersonal    form={form} setForm={handleChange} />}
            {activeTab === 'professional' && <TabProfessional form={form} setForm={handleChange} />}
            {activeTab === 'employment'   && <TabEmployment  form={form} setForm={handleChange} />}
            {activeTab === 'schedule'     && <ComingSoonBanner feature="Lịch làm việc" />}
            {activeTab === 'salary'       && <ComingSoonBanner feature="Tài chính & Lương thưởng" />}
            {activeTab === 'account'      && <TabAccount data={data} />}
            {activeTab === 'documents'    && <TabDocuments form={form} setForm={handleChange} />}
          </div>

          {/* Footer actions */}
          {!noSave && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={handleCancel} disabled={!dirty || mutation.isPending} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 18px', borderRadius: '8px', border: '1px solid #e5e7eb',
                backgroundColor: 'white', color: dirty ? '#374151' : '#9ca3af',
                fontSize: '13px', fontWeight: 500, cursor: dirty ? 'pointer' : 'default',
              }}>
                <X size={14} /> Hủy bỏ
              </button>
              <button onClick={handleSave} disabled={!dirty || mutation.isPending} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 18px', borderRadius: '8px', border: 'none',
                backgroundColor: dirty && !mutation.isPending ? '#2563eb' : '#93c5fd',
                color: 'white', fontSize: '13px', fontWeight: 600,
                cursor: dirty && !mutation.isPending ? 'pointer' : 'default',
              }}>
                {mutation.isPending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                {mutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
