import React, { useState, useEffect, useCallback } from 'react'
import {
  Receipt, Search, RefreshCw, CheckCircle2, Clock, XCircle,
  CreditCard, Banknote, Smartphone, ChevronRight, AlertTriangle,
  Printer, User, Stethoscope, Calendar,
} from 'lucide-react'
import { invoiceApi } from '../../api/invoice.api'
import type { Invoice } from '../../api/invoice.api'

// ─── Cấu hình ngân hàng phòng khám ───────────────────────────
const BANK_CONFIG = {
  bankId:      '970407',           // Techcombank
  accountNo:   '19073633802015',   // Số tài khoản
  accountName: 'VU HONG NHUNG',   // Tên chủ tài khoản
  bankName:    'Techcombank',
}

/** Tạo URL ảnh QR VietQR với số tiền và nội dung điền sẵn */
function vietQRUrl(amount: number, description: string): string {
  const params = new URLSearchParams({
    amount:      String(amount),
    addInfo:     description,
    accountName: BANK_CONFIG.accountName,
  })
  return `https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-compact2.png?${params}`
}

// ─── VietQR panel component ───────────────────────────────────

function VietQRPanel({ amount, invoiceCode }: { amount: number; invoiceCode: string }) {
  const description = `TT ${invoiceCode}`
  const qrUrl = vietQRUrl(amount, description)

  return (
    <div style={{
      border: '1.5px solid #bfdbfe', borderRadius: 12, background: '#eff6ff',
      padding: '16px 20px', display: 'flex', gap: 20, alignItems: 'center',
    }}>
      {/* QR image */}
      <div style={{
        background: '#fff', borderRadius: 10, padding: 8,
        border: '1px solid #e5e7eb', flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <img
          src={qrUrl}
          alt="VietQR"
          width={160}
          height={160}
          style={{ display: 'block', borderRadius: 6 }}
          onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/160x160?text=QR+Error' }}
        />
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a8a', marginBottom: 10 }}>
          Quét mã chuyển khoản
        </div>
        <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
          <InfoRow label="Ngân hàng"   value={BANK_CONFIG.bankName} />
          <InfoRow label="Số tài khoản" value={BANK_CONFIG.accountNo} mono />
          <InfoRow label="Tên TK"      value={BANK_CONFIG.accountName} />
          <InfoRow
            label="Số tiền"
            value={amount.toLocaleString('vi-VN') + 'đ'}
            highlight
          />
          <InfoRow label="Nội dung CK" value={description} mono highlight />
        </div>
        <div style={{
          marginTop: 10, fontSize: 11, color: '#2563eb',
          background: '#dbeafe', borderRadius: 6, padding: '5px 8px',
        }}>
          📱 Khách quét QR → số tiền &amp; nội dung tự điền sẵn
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono, highlight }: {
  label: string; value: string; mono?: boolean; highlight?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
      <span style={{ color: '#6b7280', minWidth: 90 }}>{label}:</span>
      <span style={{
        fontWeight: highlight ? 800 : 600,
        color:      highlight ? '#1e3a8a' : '#1f2937',
        fontFamily: mono ? 'monospace' : 'inherit',
        fontSize:   highlight ? 13 : 12,
        wordBreak: 'break-all',
      }}>{value}</span>
    </div>
  )
}

// ─── Status helpers ───────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  WAITING_PAYMENT: { label: 'Chờ thanh toán', color: '#d97706', bg: '#fef3c7', icon: <Clock   size={12} /> },
  PAID:            { label: 'Đã thanh toán',  color: '#059669', bg: '#d1fae5', icon: <CheckCircle2 size={12} /> },
  CANCELLED:       { label: 'Đã hủy',         color: '#9ca3af', bg: '#f3f4f6', icon: <XCircle  size={12} /> },
  REFUNDED:        { label: 'Đã hoàn tiền',   color: '#6366f1', bg: '#ede9fe', icon: <RefreshCw size={12} /> },
}

const PAYMENT_METHODS = [
  { key: 'CARD',    label: 'Chuyển khoản / POS', icon: <CreditCard  size={16} /> },
  { key: 'CASH',    label: 'Tiền mặt',            icon: <Banknote    size={16} /> },
  { key: 'MOMO',    label: 'MoMo',                icon: <Smartphone  size={16} /> },
  { key: 'ZALOPAY', label: 'ZaloPay',             icon: <Smartphone  size={16} /> },
]

const CLASS_COLOR: Record<string, string> = {
  NEW: '#6b7280', RETURNING: '#2563eb', VIP: '#d97706', SPECIAL: '#dc2626',
}

function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }
function fmtDate(s: string) {
  const d = new Date(s)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ─── Invoice card (left list) ─────────────────────────────────

function InvoiceCard({ inv, selected, onClick }: {
  inv: Invoice; selected: boolean; onClick: () => void
}) {
  const st = STATUS_META[inv.status] ?? STATUS_META.WAITING_PAYMENT
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 6,
        borderRadius: 10,
        border:      selected ? '2px solid #6366f1' : '1px solid #e5e7eb',
        background:  selected ? '#f0f0ff' : '#fff',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>{inv.patient.fullName}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{inv.code}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>BS. {inv.doctor.fullName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#6366f1' }}>{fmt(inv.totalAmount)}</div>
          <div style={{
            marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 600, color: st.color, background: st.bg,
            padding: '2px 7px', borderRadius: 20,
          }}>
            {st.icon} {st.label}
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Receipt HTML builder ─────────────────────────────────────

function buildReceiptHtml(inv: Invoice, opts: { draft: boolean }): string {
  const fmtN  = (n: number) => n.toLocaleString('vi-VN') + 'đ'
  const fmtDt = (s: string) => {
    const d = new Date(s)
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }
  const pmLabel: Record<string,string> = { CARD: 'Chuyển khoản / POS', CASH: 'Tiền mặt', MOMO: 'MoMo', ZALOPAY: 'ZaloPay' }

  // Hiện QR: luôn luôn khi tạm tính, hoặc khi đã thanh toán bằng chuyển khoản
  const showQR = opts.draft || (!opts.draft && inv.paymentMethod === 'CARD')
  const qrDesc = encodeURIComponent(`TT ${inv.code}`)
  const qrParams = `amount=${inv.totalAmount}&addInfo=${qrDesc}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`
  const qrImgUrl = `https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-compact2.png?${qrParams}`
  const qrSection = showQR ? `
    <div style="margin:14px 0;padding:12px;border:1.5px dashed #2563eb;border-radius:10px;background:#eff6ff">
      <div style="text-align:center;font-weight:800;font-size:13px;color:#1e3a8a;margin-bottom:10px">
        ${opts.draft ? '📲 Quét mã để thanh toán' : '🏦 Thanh toán chuyển khoản'}
      </div>
      <div style="display:flex;gap:12px;align-items:center">
        <img src="${qrImgUrl}" width="120" height="120" style="border-radius:8px;border:1px solid #e5e7eb;background:#fff;padding:4px;flex-shrink:0"/>
        <div style="font-size:11px;line-height:1.8">
          <div><span style="color:#6b7280">Ngân hàng:</span> <strong>${BANK_CONFIG.bankName}</strong></div>
          <div><span style="color:#6b7280">Số TK:</span> <strong style="font-family:monospace">${BANK_CONFIG.accountNo}</strong></div>
          <div><span style="color:#6b7280">Chủ TK:</span> ${BANK_CONFIG.accountName}</div>
          <div><span style="color:#6b7280">Số tiền:</span> <strong style="color:#2563eb">${fmtN(inv.totalAmount)}</strong></div>
          <div><span style="color:#6b7280">Nội dung:</span> <strong style="font-family:monospace;color:#7c3aed">TT ${inv.code}</strong></div>
        </div>
      </div>
    </div>` : ''

  const rows = inv.items.map(it => `
    <tr>
      <td style="padding:6px 4px;border-bottom:1px dashed #e5e7eb">
        ${it.serviceName}${it.toothNumber ? ` <span style="color:#9ca3af;font-size:11px">(R.${it.toothNumber})</span>` : ''}
        ${it.quantity > 1 ? `<br><span style="color:#9ca3af;font-size:11px">×${it.quantity}</span>` : ''}
      </td>
      <td style="padding:6px 4px;border-bottom:1px dashed #e5e7eb;text-align:right;white-space:nowrap">${it.unitPrice.toLocaleString('vi-VN')}</td>
      <td style="padding:6px 4px;border-bottom:1px dashed #e5e7eb;text-align:right;white-space:nowrap;font-weight:700">${it.amount.toLocaleString('vi-VN')}</td>
    </tr>`).join('')

  const discountRow = inv.discountAmount > 0 ? `
    <tr>
      <td colspan="2" style="padding:5px 4px;color:#059669">Giảm giá${inv.discountPct > 0 ? ` (${inv.discountPct}%)` : ''}${inv.voucherCode ? ` · ${inv.voucherCode}` : ''}</td>
      <td style="padding:5px 4px;text-align:right;color:#059669;font-weight:700">-${fmtN(inv.discountAmount)}</td>
    </tr>` : ''

  const watermark = opts.draft
    ? `<div style="position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:64px;font-weight:900;color:rgba(0,0,0,0.06);pointer-events:none;white-space:nowrap;z-index:0">TẠM TÍNH</div>`
    : ''

  const statusBadge = opts.draft
    ? `<div style="text-align:center;margin:8px 0 4px;font-size:13px;color:#d97706;font-weight:700;border:1.5px dashed #d97706;border-radius:6px;padding:5px">⏳ PHIẾU TẠM TÍNH – CHƯA THANH TOÁN</div>`
    : `<div style="text-align:center;margin:8px 0 4px;font-size:13px;color:#059669;font-weight:700;border:1.5px solid #059669;border-radius:6px;padding:5px">✓ ĐÃ THANH TOÁN · ${inv.paidAt ? fmtDt(inv.paidAt) : ''}</div>`

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <title>Hóa đơn ${inv.code}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #1f2937; background: #fff; padding: 20px }
    @media print {
      body { padding: 0 }
      @page { margin: 14mm 10mm; size: 80mm auto }
    }
  </style>
</head>
<body>
  ${watermark}
  <div style="max-width:380px;margin:0 auto;position:relative;z-index:1">

    <!-- Clinic header -->
    <div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #1f2937">
      <div style="font-size:18px;font-weight:900;color:#1e3a8a;letter-spacing:1px">🦷 DENTCARE PRO</div>
      <div style="font-size:11px;color:#6b7280;margin-top:3px">Phòng khám Nha khoa</div>
      <div style="font-size:11px;color:#6b7280">ĐT: 1900-xxxx · Email: info@dentcarepro.vn</div>
    </div>

    <!-- Invoice title -->
    <div style="text-align:center;margin-bottom:14px">
      <div style="font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:1px">Hóa đơn dịch vụ nha khoa</div>
      <div style="font-size:12px;color:#6b7280;margin-top:4px">Mã HĐ: <strong>${inv.code}</strong></div>
      <div style="font-size:11px;color:#9ca3af">Ngày lập: ${fmtDt(inv.createdAt)}</div>
    </div>

    ${statusBadge}

    <!-- Patient info -->
    <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;margin:12px 0;border:1px solid #e5e7eb">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr><td style="color:#6b7280;padding:2px 0;width:40%">Bệnh nhân:</td><td style="font-weight:700">${inv.patient.fullName}</td></tr>
        <tr><td style="color:#6b7280;padding:2px 0">Mã BN:</td><td>${inv.patient.code}</td></tr>
        <tr><td style="color:#6b7280;padding:2px 0">SĐT:</td><td>${inv.patient.phone}</td></tr>
        <tr><td style="color:#6b7280;padding:2px 0">Bác sĩ:</td><td>BS. ${inv.doctor.fullName}</td></tr>
        ${inv.dentalRecord.icd10Code ? `<tr><td style="color:#6b7280;padding:2px 0">Chẩn đoán:</td><td>${inv.dentalRecord.icd10Code} – ${inv.dentalRecord.icd10Description ?? ''}</td></tr>` : ''}
      </table>
    </div>

    <!-- Services -->
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px">
      <thead>
        <tr style="background:#1e3a8a;color:#fff">
          <th style="padding:7px 4px;text-align:left;border-radius:4px 0 0 0">Dịch vụ</th>
          <th style="padding:7px 4px;text-align:right">Đơn giá</th>
          <th style="padding:7px 4px;text-align:right;border-radius:0 4px 0 0">T.Tiền</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <!-- Totals -->
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px">
      <tr>
        <td style="padding:4px 0;color:#6b7280">Tổng cộng</td>
        <td style="text-align:right;padding:4px 0">${fmtN(inv.subtotal)}</td>
      </tr>
      ${discountRow}
      <tr>
        <td colspan="2"><div style="border-top:2px solid #1f2937;margin:6px 0"></div></td>
      </tr>
      <tr>
        <td style="font-size:15px;font-weight:900">KHÁCH PHẢI TRẢ</td>
        <td style="text-align:right;font-size:17px;font-weight:900;color:#2563eb">${fmtN(inv.totalAmount)}</td>
      </tr>
      ${!opts.draft && inv.paymentMethod ? `
      <tr>
        <td style="padding-top:6px;color:#059669;font-size:12px">Thanh toán bằng</td>
        <td style="text-align:right;padding-top:6px;color:#059669;font-size:12px;font-weight:700">${pmLabel[inv.paymentMethod] ?? inv.paymentMethod}</td>
      </tr>` : ''}
    </table>

    ${qrSection}

    <!-- Footer -->
    <div style="text-align:center;border-top:1px dashed #d1d5db;padding-top:12px;margin-top:4px;font-size:11px;color:#9ca3af">
      <div>Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ!</div>
      <div style="margin-top:3px">Hẹn gặp lại 😊</div>
      <div style="margin-top:8px;font-size:10px">In ngày: ${fmtDt(new Date().toISOString())}</div>
    </div>
  </div>
</body>
</html>`
}

// ─── Right panel: invoice detail + payment ────────────────────

function InvoiceDetail({ inv, onRefresh }: { inv: Invoice; onRefresh: () => void }) {
  const [discountPct,  setDiscountPct]  = useState(inv.discountPct)
  const [voucherCode,  setVoucherCode]  = useState(inv.voucherCode ?? '')
  const [payMethod,    setPayMethod]    = useState<string>(inv.paymentMethod ?? 'CARD')
  const [paying,       setPaying]       = useState(false)
  const [discounting,  setDiscounting]  = useState(false)

  const isPaid   = inv.status === 'PAID'
  const isWaiting = inv.status === 'WAITING_PAYMENT'

  // Recalc discount when pct changes
  const discountAmount = Math.round(inv.subtotal * discountPct / 100)
  const payable        = Math.max(0, inv.subtotal - discountAmount)

  const handleApplyDiscount = async () => {
    setDiscounting(true)
    try {
      await invoiceApi.applyDiscount(inv.id, { discountPct, voucherCode: voucherCode || undefined })
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Lỗi áp dụng ưu đãi')
    } finally { setDiscounting(false) }
  }

  const handlePay = async () => {
    if (!confirm(`Xác nhận thu ${fmt(inv.totalAmount)} từ ${inv.patient.fullName}?`)) return
    setPaying(true)
    try {
      await invoiceApi.pay(inv.id, { paymentMethod: payMethod })
      onRefresh()
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Lỗi thanh toán')
    } finally { setPaying(false) }
  }

  // In tạm tính (chờ thanh toán)
  const handlePrintDraft = () => {
    const win = window.open('', '_blank', 'width=420,height=700')
    if (!win) return
    win.document.write(buildReceiptHtml(inv, { draft: true }))
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  // In hóa đơn chính thức (đã thanh toán)
  const handlePrintFinal = () => {
    const win = window.open('', '_blank', 'width=420,height=700')
    if (!win) return
    win.document.write(buildReceiptHtml(inv, { draft: false }))
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: '#f8fafc' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1f2937', margin: 0 }}>Hóa đơn &amp; Thanh toán</h2>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Xác nhận hóa đơn và thu tiền dịch vụ nha khoa.</p>
        </div>
        {isPaid && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '6px 14px', borderRadius: 20 }}>
            <CheckCircle2 size={16} /> Đã thanh toán
          </div>
        )}
      </div>

      {/* Patient + invoice meta */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%', background: '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0,
            }}>
              {inv.patient.fullName.charAt(0)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#1f2937' }}>{inv.patient.fullName}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: CLASS_COLOR[inv.patient.classification] ?? '#6b7280',
                  background: '#f3f4f6', padding: '2px 8px', borderRadius: 20,
                }}>
                  {inv.patient.classification}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Mã BN: {inv.patient.code} · SĐT: {inv.patient.phone}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>Hóa đơn #{inv.code}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} /> {fmtDate(inv.createdAt)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6', fontSize: 12, color: '#6b7280' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Stethoscope size={12} /> BS. {inv.doctor.fullName}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Receipt size={12} /> {inv.dentalRecord.code}
          </span>
          {inv.dentalRecord.icd10Code && (
            <span>ICD-10: <strong>{inv.dentalRecord.icd10Code}</strong> – {inv.dentalRecord.icd10Description}</span>
          )}
        </div>
      </div>

      {/* Service table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', margin: '0 0 12px' }}>
          Chi tiết dịch vụ
        </h3>
        {inv.items.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 13 }}>Không có dịch vụ</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['DỊCH VỤ', 'BHYT', 'ĐƠN GIÁ', 'THÀNH TIỀN'].map(h => (
                  <th key={h} style={{
                    padding: '8px 10px', textAlign: h === 'ĐƠN GIÁ' || h === 'THÀNH TIỀN' ? 'right' : 'left',
                    fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inv.items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 10px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1f2937' }}>
                      {item.serviceName}
                      {item.toothNumber && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>– Răng {item.toothNumber}</span>}
                    </div>
                    {item.quantity > 1 && (
                      <div style={{ fontSize: 11, color: '#6b7280' }}>×{item.quantity}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 10px', fontSize: 12 }}>
                    <span style={{
                      color:      item.bhytCovered ? '#059669' : '#6b7280',
                      fontWeight: item.bhytCovered ? 700 : 400,
                    }}>
                      {item.bhytCovered ? 'Có' : 'Không'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 13 }}>
                    {item.unitPrice.toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#1f2937' }}>
                    {item.amount.toLocaleString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Discount / voucher */}
      {isWaiting && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', margin: '0 0 12px' }}>Ưu đãi / Giảm giá</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={voucherCode}
              onChange={e => setVoucherCode(e.target.value)}
              placeholder="Mã voucher..."
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 8,
                border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number" min="0" max="100"
                value={discountPct}
                onChange={e => setDiscountPct(Number(e.target.value))}
                placeholder="%"
                style={{
                  width: 72, padding: '9px 10px', borderRadius: 8,
                  border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none', textAlign: 'center',
                }}
              />
              <span style={{ fontSize: 13, color: '#6b7280' }}>%</span>
            </div>
            <button
              onClick={handleApplyDiscount}
              disabled={discounting}
              style={{
                padding: '9px 16px', borderRadius: 8, border: 'none',
                background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {discounting ? '...' : 'Áp dụng'}
            </button>
          </div>
        </div>
      )}

      {/* Payment method */}
      {isWaiting && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', margin: '0 0 12px' }}>Phương thức thanh toán</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {PAYMENT_METHODS.map(pm => (
              <button
                key={pm.key}
                onClick={() => setPayMethod(pm.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: payMethod === pm.key ? '2px solid #6366f1' : '1.5px solid #d1d5db',
                  background: payMethod === pm.key ? '#ede9fe' : '#fff',
                  color:      payMethod === pm.key ? '#4f46e5' : '#374151',
                  cursor: 'pointer',
                }}
              >
                {pm.icon} {pm.label}
              </button>
            ))}
          </div>

          {/* VietQR panel – hiện khi chọn Chuyển khoản */}
          {payMethod === 'CARD' && (
            <VietQRPanel
              amount={isWaiting && discountPct !== inv.discountPct ? payable : inv.totalAmount}
              invoiceCode={inv.code}
            />
          )}
        </div>
      )}

      {/* Paid method display */}
      {isPaid && inv.paymentMethod && (
        <div style={{ background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0', padding: '12px 20px', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: '#166534' }}>
            Thanh toán bằng: <strong>{PAYMENT_METHODS.find(p => p.key === inv.paymentMethod)?.label ?? inv.paymentMethod}</strong>
            {inv.paidAt && <> · {fmtDate(inv.paidAt)}</>}
          </span>
        </div>
      )}

      {/* Total summary */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Tổng cộng</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{fmt(inv.subtotal)}</span>
        </div>
        {inv.discountAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              Giảm giá {inv.discountPct > 0 ? `(${inv.discountPct}%)` : ''}
              {inv.voucherCode ? ` – ${inv.voucherCode}` : ''}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>–{fmt(inv.discountAmount)}</span>
          </div>
        )}
        {/* Preview if discount is being set */}
        {isWaiting && discountPct > 0 && discountPct !== inv.discountPct && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Giảm dự kiến ({discountPct}%)</span>
            <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>–{fmt(discountAmount)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '2px solid #f3f4f6' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#1f2937' }}>Khách phải trả</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#6366f1' }}>
            {isWaiting && discountPct !== inv.discountPct ? fmt(payable) : fmt(inv.totalAmount)}
          </span>
        </div>
      </div>

      {/* Action buttons – chờ thanh toán */}
      {isWaiting && (
        <div style={{ display: 'flex', gap: 12, paddingBottom: 32 }}>
          <button
            onClick={handlePrintDraft}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', borderRadius: 8, border: '1.5px solid #d1d5db',
              background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Printer size={15} /> In tạm tính
          </button>
          <button
            onClick={handlePay}
            disabled={paying}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px', borderRadius: 8, border: 'none',
              background: paying ? '#a5b4fc' : '#059669',
              color: '#fff', fontSize: 14, fontWeight: 800, cursor: paying ? 'not-allowed' : 'pointer',
            }}
          >
            <CheckCircle2 size={16} />
            {paying ? 'Đang xử lý...' : 'Xác nhận Thanh toán'}
          </button>
        </div>
      )}

      {/* Action buttons – đã thanh toán */}
      {isPaid && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 32 }}>
          <button
            onClick={handlePrintFinal}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 24px', borderRadius: 9, border: 'none',
              background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
            }}
          >
            <Printer size={16} /> In hóa đơn
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────

export default function InvoicePage() {
  const [tab,       setTab]      = useState<'WAITING_PAYMENT' | 'PAID'>('WAITING_PAYMENT')
  const [search,    setSearch]   = useState('')
  const [invoices,  setInvoices] = useState<Invoice[]>([])
  const [total,     setTotal]    = useState(0)
  const [selected,  setSelected] = useState<Invoice | null>(null)
  const [loading,   setLoading]  = useState(true)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const result = await invoiceApi.list({ status: tab, search: search || undefined })
      setInvoices(result.items)
      setTotal(result.total)
      // Re-fetch selected if it changed
      if (selected) {
        const fresh = result.items.find(i => i.id === selected.id)
        if (fresh) setSelected(fresh)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [tab, search])

  useEffect(() => { fetchList() }, [fetchList])

  const handleSelect = async (inv: Invoice) => {
    // Fetch fresh detail
    try {
      const detail = await invoiceApi.get(inv.id)
      setSelected(detail)
    } catch {
      setSelected(inv)
    }
  }

  const handleRefresh = async () => {
    await fetchList()
    if (selected) {
      try {
        const detail = await invoiceApi.get(selected.id)
        setSelected(detail)
      } catch { /* ignore */ }
    }
  }

  const waitingCount = tab === 'WAITING_PAYMENT' ? total : '?'
  const paidCount    = tab === 'PAID'             ? total : '?'

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

      {/* ── Left: list ── */}
      <div style={{
        width: 300, flexShrink: 0, borderRight: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column', background: '#fafafa',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          {([
            { key: 'WAITING_PAYMENT', label: `Chờ thanh toán (${tab === 'WAITING_PAYMENT' ? total : '...'})` },
            { key: 'PAID',            label: 'Đã thanh toán' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelected(null) }}
              style={{
                flex: 1, padding: '12px 6px', border: 'none', background: 'none',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                color:        tab === t.key ? '#6366f1' : '#6b7280',
                borderBottom: tab === t.key ? '2px solid #6366f1' : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo Mã HĐ, Tên BN..."
              style={{
                width: '100%', paddingLeft: 28, paddingRight: 8, paddingTop: 8, paddingBottom: 8,
                borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 24, fontSize: 12 }}>Đang tải...</div>
          ) : invoices.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>
              <Receipt size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div style={{ fontSize: 12 }}>Không có hóa đơn</div>
            </div>
          ) : invoices.map(inv => (
            <InvoiceCard
              key={inv.id}
              inv={inv}
              selected={selected?.id === inv.id}
              onClick={() => handleSelect(inv)}
            />
          ))}
        </div>
      </div>

      {/* ── Right: detail ── */}
      {!selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', background: '#f8fafc' }}>
          <Receipt size={48} style={{ opacity: 0.25, marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>Chọn hóa đơn để xem chi tiết</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Chọn từ danh sách bên trái</div>
        </div>
      ) : (
        <InvoiceDetail key={selected.id} inv={selected} onRefresh={handleRefresh} />
      )}
    </div>
  )
}
