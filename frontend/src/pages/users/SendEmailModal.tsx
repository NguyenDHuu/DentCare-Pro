import { useState, useRef } from 'react'
import { X, Mail, Paperclip, FileText, Image, Trash2, Upload } from 'lucide-react'
import { authApi } from '../../api/auth.api'

const MAX_FILES = 5
const MAX_SIZE  = 10 * 1024 * 1024 // 10 MB
const ALLOWED   = ['application/pdf', 'image/png', 'image/jpeg']
const EXT_LABEL: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png':       'PNG',
  'image/jpeg':      'JPG',
}

function fileIcon(type: string) {
  if (type === 'application/pdf') return <FileText size={14} color="#ef4444" />
  return <Image size={14} color="#3b82f6" />
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  user: { id: number; fullName: string; email: string }
  onClose: () => void
}

export default function SendEmailModal({ user, onClose }: Props) {
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles]     = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const [dragging, setDragging]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<{ ok: boolean; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    setFileError('')
    const toAdd: File[] = []
    const errors: string[] = []

    Array.from(incoming).forEach(f => {
      if (!ALLOWED.includes(f.type))
        return errors.push(`"${f.name}" không đúng định dạng (chỉ PDF, PNG, JPG).`)
      if (f.size > MAX_SIZE)
        return errors.push(`"${f.name}" vượt quá 10MB.`)
      if (files.length + toAdd.length >= MAX_FILES)
        return errors.push(`Tối đa ${MAX_FILES} file đính kèm.`)
      if (files.some(x => x.name === f.name && x.size === f.size))
        return // bỏ qua file trùng
      toAdd.push(f)
    })

    if (errors.length) setFileError(errors[0])
    if (toAdd.length)  setFiles(prev => [...prev, ...toAdd])
  }

  const removeFile = (idx: number) =>
    setFiles(prev => prev.filter((_, i) => i !== idx))

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const handleSend = async () => {
    if (!subject.trim() || !content.trim())
      return setResult({ ok: false, text: 'Vui lòng nhập tiêu đề và nội dung.' })

    setLoading(true); setResult(null)
    try {
      await authApi.sendEmail(user.id, subject.trim(), content.trim(), files)
      setResult({ ok: true, text: `Gửi email thành công${files.length ? ` (${files.length} file đính kèm).` : '.'}` })
      setTimeout(onClose, 1800)
    } catch (err: any) {
      setResult({ ok: false, text: err.response?.data?.message || 'Lỗi hệ thống' })
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: '1px solid #e5e7eb', fontSize: '13px', color: '#111827',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', width: '500px',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '24px 24px 0' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>Gửi Email</h2>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Gửi thông báo đến <strong>{user.fullName}</strong> ({user.email}).
            </p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Tiêu đề */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
              Tiêu đề email <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input style={inputStyle} placeholder="Nhập tiêu đề..." value={subject}
              onChange={e => { setSubject(e.target.value); setResult(null) }} />
          </div>

          {/* Nội dung */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
              Nội dung <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea value={content} onChange={e => { setContent(e.target.value); setResult(null) }}
              placeholder="Nhập nội dung email..." rows={5}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {/* Đính kèm */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                <Paperclip size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Đính kèm tài liệu
                <span style={{ fontSize: '11px', fontWeight: 400, color: '#9ca3af', marginLeft: '6px' }}>
                  ({files.length}/{MAX_FILES}) · PDF, PNG, JPG · Tối đa 10MB/file
                </span>
              </label>
              {files.length > 0 && (
                <button onClick={() => setFiles([])}
                  style={{ fontSize: '11px', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}>
                  Xóa tất cả
                </button>
              )}
            </div>

            {/* Drop zone */}
            {files.length < MAX_FILES && (
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? '#2563eb' : '#d1d5db'}`,
                  borderRadius: '10px', padding: '20px',
                  textAlign: 'center', cursor: 'pointer',
                  backgroundColor: dragging ? '#eff6ff' : '#f9fafb',
                  transition: 'all 0.15s',
                }}
              >
                <Upload size={22} color={dragging ? '#2563eb' : '#9ca3af'} style={{ marginBottom: '6px' }} />
                <p style={{ fontSize: '13px', color: dragging ? '#2563eb' : '#6b7280', fontWeight: 500 }}>
                  Nhấn để chọn file hoặc kéo thả vào đây
                </p>
                <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                  Hỗ trợ: PDF · PNG · JPG
                </p>
                <input ref={inputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg"
                  style={{ display: 'none' }}
                  onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
              </div>
            )}

            {/* Lỗi file */}
            {fileError && (
              <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px' }}>{fileError}</p>
            )}

            {/* Danh sách file đã chọn */}
            {files.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {files.map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '8px',
                    backgroundColor: '#f8fafc', border: '1px solid #e5e7eb',
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '6px',
                      backgroundColor: f.type === 'application/pdf' ? '#fef2f2' : '#eff6ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {fileIcon(f.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </p>
                      <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
                        {EXT_LABEL[f.type] ?? 'File'} · {formatSize(f.size)}
                      </p>
                    </div>
                    <button onClick={() => removeFile(i)} title="Xóa file"
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {result && (
            <div style={{
              padding: '10px 12px', borderRadius: '8px', fontSize: '13px',
              backgroundColor: result.ok ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${result.ok ? '#86efac' : '#fca5a5'}`,
              color: result.ok ? '#16a34a' : '#dc2626',
            }}>{result.text}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', padding: '0 24px 24px' }}>
          <button onClick={onClose} style={{
            padding: '9px 16px', borderRadius: '8px', border: '1px solid #e5e7eb',
            background: 'white', fontSize: '13px', cursor: 'pointer', color: '#374151',
          }}>Hủy</button>
          <button onClick={handleSend} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 18px', borderRadius: '8px', border: 'none',
            backgroundColor: loading ? '#93c5fd' : '#2563eb', color: 'white',
            fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            <Mail size={14} />
            {loading ? 'Đang gửi...' : `Gửi email${files.length ? ` (${files.length} file)` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
