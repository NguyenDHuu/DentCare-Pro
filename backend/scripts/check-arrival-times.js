const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  // arrivedAt stored as UTC. VN time = UTC + 7h
  // Ca sáng: 08:00-12:00, Ca chiều: 13:00-17:00, Ca tối: 17:30-20:00
  const rows = await p.$queryRawUnsafe(
    `SELECT r.id, r.code,
       HOUR(r.arrivedAt) AS h_utc, MINUTE(r.arrivedAt) AS m_utc,
       HOUR(ADDTIME(r.arrivedAt,'07:00:00')) AS h_vn,
       MINUTE(ADDTIME(r.arrivedAt,'07:00:00')) AS m_vn
     FROM reception r ORDER BY r.id`
  )
  console.log('Arrival hours (UTC vs VN+7):')
  rows.forEach(r => {
    const utc = `${r.h_utc}:${String(r.m_utc).padStart(2,'0')}`
    const vn  = `${r.h_vn}:${String(r.m_vn).padStart(2,'0')}`
    console.log(`  ${r.code} — UTC=${utc} VN=${vn}`)
  })

  // Check matching schedule by time range
  const matched = await p.$queryRawUnsafe(
    `SELECT r.id, r.code, ws.name AS shiftName, ds.id AS schedId
     FROM reception r
     LEFT JOIN doctorschedule ds
       ON ds.doctorId = r.doctorId
       AND DATE(ADDTIME(ds.workDate,'07:00:00')) = DATE(ADDTIME(r.arrivedAt,'07:00:00'))
     LEFT JOIN workshift ws
       ON ws.id = ds.shiftId
       AND TIME(ADDTIME(r.arrivedAt,'07:00:00')) BETWEEN ws.startTime AND ws.endTime
     WHERE r.doctorId IS NOT NULL
     ORDER BY r.id`
  )
  console.log('\nBest shift match per reception:')
  matched.forEach(r => console.log(`  ${r.code} → schedId=${r.schedId} shift=${r.shiftName}`))
}
main().catch(e=>console.error('ERR:',e.message)).finally(()=>p.$disconnect())
