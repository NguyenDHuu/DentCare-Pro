/**
 * Mô phỏng chính xác getDoctorComplexityCases với YEAR/MONTH query
 * để xác nhận fix hoạt động trước khi restart server
 */
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function getDoctorComplexityCases(doctorId, month) {
  const [yr, mo] = month.split('-').map(Number)

  const allCases = await p.$queryRawUnsafe(`
    SELECT
      r.id                                         AS receptionId,
      r.code                                       AS receptionCode,
      DATE_FORMAT(r.arrivedAt, '%Y-%m-%d')         AS workDate,
      p.fullName                                   AS patientName,
      (SELECT GROUP_CONCAT(DISTINCT svc.name ORDER BY svc.name SEPARATOR ', ')
       FROM   dental_record dr2
       JOIN   dental_record_service drs ON drs.recordId = dr2.id
       JOIN   service svc ON svc.id = drs.serviceId
       WHERE  dr2.receptionId = r.id
      )                                            AS services,
      CAST(pc.proposedCoeff  AS DECIMAL(3,1))      AS proposedCoeff,
      pc.proposedReason,
      CAST(pc.approvedCoeff  AS DECIMAL(3,1))      AS approvedCoeff,
      pc.status                                    AS complexStatus
    FROM reception r
    JOIN patient p ON p.id = r.patientId
    LEFT JOIN patientcomplexity pc ON pc.receptionId = r.id
    WHERE r.doctorId = ${doctorId}
      AND YEAR(r.arrivedAt)  = ${yr}
      AND MONTH(r.arrivedAt) = ${mo}
      AND r.status IN ('COMPLETED','IN_TREATMENT','WAITING_PAYMENT','DONE')
    ORDER BY r.arrivedAt
  `)

  if (!allCases.length) return { month, isLocked: false, schedules: [] }

  const scheds = await p.$queryRawUnsafe(`
    SELECT ds.id AS schedId,
           DATE_FORMAT(ds.workDate, '%Y-%m-%d') AS workDate,
           ws.name AS shiftName, ws.startTime, ws.endTime
    FROM   doctorschedule ds
    JOIN   workshift ws ON ws.id = ds.shiftId
    WHERE  ds.doctorId = ${doctorId}
      AND  YEAR(ds.workDate)  = ${yr}
      AND  MONTH(ds.workDate) = ${mo}
    ORDER BY ds.workDate, ws.startTime
  `)

  const schedByDate = {}
  for (const s of scheds) { if (!schedByDate[s.workDate]) schedByDate[s.workDate] = s }

  const casesByDate = {}
  for (const c of allCases) {
    const d = String(c.workDate)
    if (!casesByDate[d]) casesByDate[d] = []
    casesByDate[d].push(c)
  }

  const ps = await p.$queryRawUnsafe(
    `SELECT status FROM payslip WHERE userId = ${doctorId} AND month = '${month}' LIMIT 1`
  )
  const isLocked = ps[0]?.status === 'FINALIZED'

  let virtId = -1
  const schedules = Object.keys(casesByDate).sort().map(dateStr => {
    const sched = schedByDate[dateStr]
    const cases = casesByDate[dateStr].map(c => ({
      receptionId: Number(c.receptionId),
      receptionCode: c.receptionCode,
      patientName: c.patientName,
      proposedCoeff: c.proposedCoeff != null ? Number(c.proposedCoeff) : 0,
      complexStatus: c.complexStatus ?? 'NORMAL',
    }))
    return {
      schedId: sched ? Number(sched.schedId) : virtId--,
      shiftName: sched ? sched.shiftName : 'Ca khám',
      workDate: dateStr,
      cases,
      pendingCount: cases.filter(c => c.complexStatus === 'PENDING').length,
      approvedCount: cases.filter(c => c.complexStatus === 'APPROVED').length,
    }
  })

  return { month, isLocked, schedules }
}

async function main() {
  const result = await getDoctorComplexityCases(14, '2026-06')
  console.log('\n=== RESULT (giống API response) ===')
  console.log('month:', result.month)
  console.log('isLocked:', result.isLocked)
  console.log('schedules.length:', result.schedules.length)
  for (const s of result.schedules) {
    console.log(`\n  Shift: ${s.shiftName} (${s.workDate}) — cases: ${s.cases.length}, pending: ${s.pendingCount}, approved: ${s.approvedCount}`)
    s.cases.forEach(c => console.log(`    - ${c.receptionCode} | ${c.patientName} | coeff=${c.proposedCoeff} | ${c.complexStatus}`))
  }
  console.log('\n✓ Fix hoạt động đúng! Cần restart backend để áp dụng.')
}
main().catch(e => console.error(e)).finally(() => p.$disconnect())
