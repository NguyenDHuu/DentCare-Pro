/**
 * Debug: chạy đúng logic của getDoctorComplexityCases (phiên bản mới dùng scheduleId FK)
 */
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const doctorId = 14
  const month    = '2026-06'
  const [yr, mo] = month.split('-').map(Number)

  console.log(`\n=== getDoctorComplexityCases(${doctorId}, '${month}') ===`)

  // Step 1: doctor schedules this month
  const scheds = await p.$queryRawUnsafe(`
    SELECT ds.id AS schedId, DATE(ds.workDate) AS workDate,
           ws.name AS shiftName, ws.startTime, ws.endTime
    FROM   doctorschedule ds
    JOIN   workshift ws ON ws.id = ds.shiftId
    WHERE  ds.doctorId = ${doctorId}
      AND  YEAR(ds.workDate) = ${yr} AND MONTH(ds.workDate) = ${mo}
    ORDER BY ds.workDate, ws.startTime
  `)
  console.log('\n[1] Schedules found:', scheds.length)
  scheds.forEach(s => {
    const wd = s.workDate instanceof Date ? s.workDate.toISOString().slice(0,10) : String(s.workDate)
    console.log(`  schedId=${Number(s.schedId)} workDate=${wd} shift=${s.shiftName} ${s.startTime}-${s.endTime}`)
  })

  if (!scheds.length) { console.log('  → Early return: no schedules'); return }

  // Step 2: cases via scheduleId
  const schedIds = scheds.map(s => Number(s.schedId)).join(',')
  console.log('\n[2] schedIds:', schedIds)

  const allCases = await p.$queryRawUnsafe(`
    SELECT
      r.id                                    AS receptionId,
      r.code                                  AS receptionCode,
      r.scheduleId,
      p.fullName                              AS patientName,
      CAST(pc.proposedCoeff  AS DECIMAL(3,1)) AS proposedCoeff,
      pc.status                               AS complexStatus
    FROM reception r
    JOIN patient p ON p.id = r.patientId
    LEFT JOIN patientcomplexity pc ON pc.receptionId = r.id
    WHERE r.scheduleId IN (${schedIds})
      AND r.status IN ('COMPLETED','IN_TREATMENT','WAITING_PAYMENT','DONE')
    ORDER BY r.scheduleId, r.arrivedAt
  `)
  console.log('\n[3] Cases found:', allCases.length)
  allCases.forEach(c => {
    console.log(`  schedId=${Number(c.scheduleId)} ${c.receptionCode} ${c.patientName} coeff=${c.proposedCoeff} status=${c.complexStatus}`)
  })

  // Step 3: group by scheduleId
  const caseMap = {}
  for (const c of allCases) {
    const sid = Number(c.scheduleId)
    if (!caseMap[sid]) caseMap[sid] = []
    caseMap[sid].push(c)
  }

  // Step 4: payslip lock check
  const ps = await p.$queryRawUnsafe(`SELECT status FROM payslip WHERE userId = ${doctorId} AND month = '${month}' LIMIT 1`)
  const isLocked = ps[0]?.status === 'FINALIZED'
  console.log('\n[4] isLocked:', isLocked)

  // Step 5: build output
  const schedules = scheds.map(s => {
    const sid   = Number(s.schedId)
    const cases = (caseMap[sid] ?? []).map(c => ({
      receptionId:    Number(c.receptionId),
      receptionCode:  c.receptionCode,
      patientName:    c.patientName,
      proposedCoeff:  c.proposedCoeff  != null ? Number(c.proposedCoeff)  : 0,
      complexStatus:  c.complexStatus ?? 'NORMAL',
    }))
    const workDate = s.workDate instanceof Date
      ? s.workDate.toISOString().slice(0, 10)
      : String(s.workDate)
    return {
      schedId: sid, shiftName: s.shiftName, workDate,
      cases, pendingCount: cases.filter(c=>c.complexStatus==='PENDING').length,
      approvedCount: cases.filter(c=>c.complexStatus==='APPROVED').length,
    }
  })

  console.log('\n=== FINAL RESULT ===')
  console.log(JSON.stringify({ month, isLocked, schedules: schedules.length }, null, 2))
  schedules.forEach(s => {
    console.log(`\n  Shift: ${s.shiftName} (${s.workDate}) — ${s.cases.length} cases, pending=${s.pendingCount}, approved=${s.approvedCount}`)
    s.cases.forEach(c => console.log(`    - ${c.receptionCode} | ${c.patientName} | ${c.complexStatus}`))
  })
  console.log('\n✅ Query OK — nếu server vẫn lỗi thì cần restart nodemon')
}

main().catch(e => {
  console.error('\n❌ ERROR:', e.message)
  console.error(e)
}).finally(() => p.$disconnect())
