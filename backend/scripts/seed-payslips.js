/**
 * seed-payslips.js
 * ─────────────────────────────────────────────────────────────
 * Tính và seed dữ liệu phiếu lương THẬT cho 6 tháng (2026-01 → 2026-06)
 * Nguồn dữ liệu:
 *   - Bác sĩ   : doctorschedule × workshift × hourlyrate × shiftcoefficient
 *   - Lễ tân/Kế toán : fixedsalary × allowance
 *
 * Nếu thiếu dữ liệu nền (hourlyrate / fixedsalary / allowance / schedule)
 * script sẽ tự seed giá trị mặc định hợp lý rồi tính lương.
 *
 * Chạy: node backend/scripts/seed-payslips.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ─── Config ───────────────────────────────────────────────────
const MONTHS = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06']
const YEAR   = 2026

// Mức giờ mặc định nếu chưa có trong DB
const DEFAULT_HOURLY_RATE = 350_000   // 350k/giờ

// Lương cố định mặc định nếu chưa có
const DEFAULT_FIXED_SALARY = {
  RECEPTIONIST: 8_000_000,
  ACCOUNTANT:   10_000_000,
}

// Số ca làm việc ngẫu nhiên mỗi tháng nếu không có lịch thực tế
// (min-max)
const SESSIONS_PER_MONTH = { min: 3, max: 8 }

// ─── Helpers ──────────────────────────────────────────────────

function parseTime(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Tính số giờ thực của một ca (trừ buffer) */
function shiftHours(shift) {
  const mins = parseTime(shift.endTime) - parseTime(shift.startTime) - (shift.bufferTime || 0)
  return Math.max(mins, 0) / 60
}

/** Ngày trong tuần 1=T2 … 7=CN */
function dayOfWeek(date) {
  const d = new Date(date).getDay() // 0=Sun, 1=Mon…
  return d === 0 ? 7 : d
}

/** Ngày đầu / cuối tháng */
function monthRange(m) {
  const [y, mo] = m.split('-').map(Number)
  return {
    start: new Date(y, mo - 1, 1),
    end:   new Date(y, mo, 0),       // last day
    days:  new Date(y, mo, 0).getDate(),
  }
}

/** Hệ số ca tương ứng hoặc 1.0 nếu chưa cấu hình */
function getCoeff(coeffMap, shiftId, dow) {
  return coeffMap[`${shiftId}_${dow}`] ?? 1.0
}

function rand(min, max) { return min + Math.floor(Math.random() * (max - min + 1)) }

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  Seed phiếu lương thật — 2026-01 → 2026-06')
  console.log('═══════════════════════════════════════════════')

  // ── 0. Lấy admin user (createdBy) ─────────────────────────
  const [adminRow] = await prisma.$queryRawUnsafe(`
    SELECT u.id FROM \`user\` u
    JOIN userrole ur ON ur.userId = u.id
    JOIN role r ON r.id = ur.roleId
    WHERE r.name = 'ADMIN' LIMIT 1
  `)
  const adminId = adminRow?.id ?? null
  console.log(`  Admin ID: ${adminId ?? '(none)'}`)

  // ── 1. Lấy danh sách nhân sự theo vai trò ─────────────────
  const getUsers = async (role) => prisma.$queryRawUnsafe(`
    SELECT u.id, u.fullName FROM \`user\` u
    JOIN userrole ur ON ur.userId = u.id
    JOIN role r ON r.id = ur.roleId
    WHERE u.isActive = 1 AND r.name = '${role}'
    ORDER BY u.id ASC
  `)

  const doctors       = await getUsers('DOCTOR')
  const receptionists = await getUsers('RECEPTIONIST')
  const accountants   = await getUsers('ACCOUNTANT')

  console.log(`\n  Nhân sự: ${doctors.length} bác sĩ | ${receptionists.length} lễ tân | ${accountants.length} kế toán`)

  if (doctors.length + receptionists.length + accountants.length === 0) {
    console.log('  ✗ Không có nhân sự nào — hãy tạo tài khoản trước')
    return
  }

  // ── 2. Đảm bảo có đơn giá giờ (hourlyrate) ────────────────
  const hrRows = await prisma.$queryRawUnsafe(`
    SELECT id, amount FROM hourlyrate
    WHERE startDate <= '${YEAR}-01-01'
      AND (endDate IS NULL OR endDate >= '${YEAR}-12-31')
    ORDER BY startDate DESC LIMIT 1
  `)

  let hourlyRate = hrRows[0]?.amount ?? null
  if (!hourlyRate) {
    // Thêm mức đơn giá mặc định
    await prisma.$executeRawUnsafe(`
      INSERT IGNORE INTO hourlyrate (amount, startDate, endDate, createdBy, createdAt, updatedAt)
      VALUES (${DEFAULT_HOURLY_RATE}, '${YEAR}-01-01', NULL, ${adminId ?? 'NULL'}, NOW(), NOW())
    `)
    hourlyRate = DEFAULT_HOURLY_RATE
    console.log(`  ✓ Tạo đơn giá giờ mặc định: ${hourlyRate.toLocaleString('vi-VN')}đ/giờ`)
  } else {
    hourlyRate = Number(hourlyRate)
    console.log(`  ✓ Đơn giá giờ: ${hourlyRate.toLocaleString('vi-VN')}đ/giờ`)
  }

  // ── 3. Lấy ca làm việc ────────────────────────────────────
  const shifts = await prisma.$queryRawUnsafe(`
    SELECT id, name, startTime, endTime, bufferTime, applyDays
    FROM workshift WHERE isActive = 1 ORDER BY startTime ASC
  `)

  console.log(`  ✓ Ca làm việc: ${shifts.length} ca`)

  if (shifts.length === 0) {
    console.log('  ✗ Không có ca làm việc — không thể tính lương bác sĩ')
  }

  // ── 4. Lấy hệ số ca (shiftcoefficient) ────────────────────
  const coeffRows = await prisma.$queryRawUnsafe(`
    SELECT shiftId, dayOfWeek, coefficient FROM shiftcoefficient
  `)
  const coeffMap = {}
  for (const c of coeffRows) {
    coeffMap[`${c.shiftId}_${c.dayOfWeek}`] = Number(c.coefficient)
  }

  // ── 5. Đảm bảo có lương cố định cho lễ tân / kế toán ──────
  for (const role of ['RECEPTIONIST', 'ACCOUNTANT']) {
    const users = role === 'RECEPTIONIST' ? receptionists : accountants
    for (const u of users) {
      const existing = await prisma.$queryRawUnsafe(`
        SELECT id FROM fixedsalary
        WHERE userId = ${u.id}
          AND startDate <= '${YEAR}-01-01'
          AND (endDate IS NULL OR endDate >= '${YEAR}-12-31')
        LIMIT 1
      `)
      if (!existing[0]) {
        const base = DEFAULT_FIXED_SALARY[role]
        // Biến động ±500k để tự nhiên hơn
        const amt  = base + rand(-500_000, 500_000)
        await prisma.$executeRawUnsafe(`
          INSERT IGNORE INTO fixedsalary (userId, amount, startDate, endDate, createdBy, createdAt, updatedAt)
          VALUES (${u.id}, ${amt}, '${YEAR}-01-01', NULL, ${adminId ?? 'NULL'}, NOW(), NOW())
        `)
        console.log(`  ✓ Tạo lương cố định cho ${u.fullName} (${role}): ${amt.toLocaleString('vi-VN')}đ`)
      }
    }
  }

  // ── 6. Đảm bảo có ít nhất 1 phụ cấp ──────────────────────
  const allowanceCount = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS cnt FROM allowance
    WHERE startDate <= '${YEAR}-01-01'
      AND (endDate IS NULL OR endDate >= '${YEAR}-12-31')
  `)
  if (Number(allowanceCount[0].cnt) === 0) {
    await prisma.$executeRawUnsafe(`
      INSERT IGNORE INTO allowance (name, amount, appliesTo, startDate, endDate, createdBy, createdAt, updatedAt)
      VALUES ('Phụ cấp chuyên cần', 300000, 'BOTH', '${YEAR}-01-01', NULL, ${adminId ?? 'NULL'}, NOW(), NOW())
    `)
    console.log('  ✓ Tạo phụ cấp chuyên cần mặc định: 300.000đ')
  }

  // ── 7. Tính & seed payslip từng tháng ─────────────────────
  console.log('\n  Tính phiếu lương...')

  let totalCreated = 0, totalSkipped = 0

  for (const month of MONTHS) {
    const { start, end } = monthRange(month)
    const [yr, mo]       = month.split('-').map(Number)

    // 7a. Lấy phụ cấp áp dụng tháng này
    const allowances = await prisma.$queryRawUnsafe(`
      SELECT appliesTo, SUM(amount) AS total
      FROM allowance
      WHERE startDate <= '${month}-28'
        AND (endDate IS NULL OR endDate >= '${month}-01')
      GROUP BY appliesTo
    `)
    const allowanceByTarget = {}
    for (const a of allowances) {
      allowanceByTarget[a.appliesTo] = Number(a.total ?? 0)
    }
    const getAllowance = (role) =>
      (allowanceByTarget['BOTH'] || 0) + (allowanceByTarget[role] || 0)

    // 7b. Lịch trực bác sĩ trong tháng này
    const schedules = await prisma.$queryRawUnsafe(`
      SELECT ds.doctorId, ds.shiftId, ds.workDate,
             ws.startTime, ws.endTime, ws.bufferTime
      FROM doctorschedule ds
      JOIN workshift ws ON ws.id = ds.shiftId
      WHERE ds.workDate >= '${start.toISOString().slice(0,10)}'
        AND ds.workDate <= '${end.toISOString().slice(0,10)}'
      ORDER BY ds.doctorId, ds.workDate
    `)

    // Group by doctor
    const byDoctor = {}
    for (const s of schedules) {
      const uid = Number(s.doctorId)
      if (!byDoctor[uid]) byDoctor[uid] = []
      byDoctor[uid].push(s)
    }

    // 7c. Phiếu lương bác sĩ
    for (const doctor of doctors) {
      const uid = Number(doctor.id)
      const existing = await prisma.$queryRawUnsafe(`
        SELECT id FROM payslip WHERE userId = ${uid} AND month = '${month}' LIMIT 1
      `)
      if (existing[0]) { totalSkipped++; continue }

      let sessions  = 0
      let totalHours = 0
      let salaryAmount = 0

      const doctorSessions = byDoctor[uid] || []

      if (doctorSessions.length > 0) {
        // Tính từ lịch thực tế
        for (const s of doctorSessions) {
          const h     = shiftHours(s)
          const dow   = dayOfWeek(s.workDate)
          const coeff = getCoeff(coeffMap, Number(s.shiftId), dow)
          salaryAmount += Math.round(h * hourlyRate * coeff)
          totalHours   += h
          sessions++
        }
      } else if (shifts.length > 0) {
        // Không có lịch thực tế → giả lập dựa trên số ca ngẫu nhiên (deterministc by doctorId+month)
        const seed   = uid * 100 + yr * 12 + mo
        const nSessions = (seed % (SESSIONS_PER_MONTH.max - SESSIONS_PER_MONTH.min + 1)) + SESSIONS_PER_MONTH.min
        // Chọn ca theo vòng
        for (let i = 0; i < nSessions; i++) {
          const shift  = shifts[i % shifts.length]
          const h      = shiftHours(shift)
          // Ngày làm: phân bố đều trong tháng
          const day    = 1 + Math.floor((i / nSessions) * monthRange(month).days)
          const date   = new Date(yr, mo - 1, Math.min(day, monthRange(month).days))
          const dow    = dayOfWeek(date)
          const coeff  = getCoeff(coeffMap, Number(shift.id), dow)
          salaryAmount += Math.round(h * hourlyRate * coeff)
          totalHours   += h
          sessions++
        }
      }

      totalHours = Math.round(totalHours * 10) / 10

      const allowance  = getAllowance('DOCTOR')
      // Khấu trừ ngẫu nhiên nhỏ (0 hoặc 100k-300k) cho một số tháng
      const deductSeed = (uid + yr * 12 + mo) % 7
      const deduction  = deductSeed < 2 ? rand(100_000, 300_000) : 0
      const netSalary  = salaryAmount + allowance - deduction

      // Trạng thái: FINALIZED cho tháng cũ, APPROVED cho tháng trước, DRAFT cho tháng gần nhất
      const now        = new Date()
      const mDate      = new Date(yr, mo - 1, 28)
      const status     = mDate < new Date(now.getFullYear(), now.getMonth() - 1, 1)
                           ? 'FINALIZED'
                           : mDate < new Date(now.getFullYear(), now.getMonth(), 1)
                             ? 'APPROVED'
                             : 'DRAFT'

      await prisma.$executeRawUnsafe(`
        INSERT IGNORE INTO payslip
          (userId, month, role, sessionCount, hoursWorked, salaryAmount, allowance, deduction, netSalary, status, createdBy)
        VALUES
          (${uid}, '${month}', 'DOCTOR', ${sessions}, ${totalHours}, ${salaryAmount},
           ${allowance}, ${deduction}, ${netSalary}, '${status}', ${adminId ?? 'NULL'})
      `)
      totalCreated++
    }

    // 7d. Phiếu lương lễ tân / kế toán
    for (const [role, users] of [['RECEPTIONIST', receptionists], ['ACCOUNTANT', accountants]]) {
      for (const u of users) {
        const uid = Number(u.id)
        const existing = await prisma.$queryRawUnsafe(`
          SELECT id FROM payslip WHERE userId = ${uid} AND month = '${month}' LIMIT 1
        `)
        if (existing[0]) { totalSkipped++; continue }

        // Lương cố định tháng này
        const fsRows = await prisma.$queryRawUnsafe(`
          SELECT amount FROM fixedsalary
          WHERE userId = ${uid}
            AND startDate <= '${month}-28'
            AND (endDate IS NULL OR endDate >= '${month}-01')
          ORDER BY startDate DESC LIMIT 1
        `)
        const salaryAmount = fsRows[0] ? Number(fsRows[0].amount) : DEFAULT_FIXED_SALARY[role]

        const allowance   = getAllowance(role)
        const deductSeed  = (uid + yr * 12 + mo) % 9
        const deduction   = deductSeed < 2 ? rand(100_000, 500_000) : 0
        const netSalary   = salaryAmount + allowance - deduction

        const now    = new Date()
        const mDate  = new Date(yr, mo - 1, 28)
        const status = mDate < new Date(now.getFullYear(), now.getMonth() - 1, 1)
                         ? 'FINALIZED'
                         : mDate < new Date(now.getFullYear(), now.getMonth(), 1)
                           ? 'APPROVED'
                           : 'DRAFT'

        await prisma.$executeRawUnsafe(`
          INSERT IGNORE INTO payslip
            (userId, month, role, salaryAmount, allowance, deduction, netSalary, status, createdBy)
          VALUES
            (${uid}, '${month}', '${role}', ${salaryAmount},
             ${allowance}, ${deduction}, ${netSalary}, '${status}', ${adminId ?? 'NULL'})
        `)
        totalCreated++
      }
    }

    console.log(`  ✓ ${month}: ${totalCreated} mới  (skip ${totalSkipped} đã tồn tại)`)
  }

  // ── 8. Tổng kết ────────────────────────────────────────────
  const summary = await prisma.$queryRawUnsafe(`
    SELECT month, COUNT(*) AS cnt, SUM(netSalary) AS fund
    FROM payslip WHERE month LIKE '${YEAR}-%'
    GROUP BY month ORDER BY month
  `)

  console.log('\n  ┌────────────┬──────────┬───────────────────┐')
  console.log('  │ Tháng      │ Nhân sự  │ Quỹ lương         │')
  console.log('  ├────────────┼──────────┼───────────────────┤')
  for (const r of summary) {
    const fund = Number(r.fund).toLocaleString('vi-VN')
    console.log(`  │ ${r.month}   │  ${String(r.cnt).padEnd(7)} │ ${fund.padStart(17)}đ │`)
  }
  console.log('  └────────────┴──────────┴───────────────────┘')
  console.log(`\n  Done. ${totalCreated} phiếu lương mới được tạo.\n`)
}

main()
  .catch(e => { console.error('\n  ✗ Lỗi:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
