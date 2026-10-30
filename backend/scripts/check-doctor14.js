const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  const scheds = await p.$queryRawUnsafe(`
    SELECT ds.id, ds.doctorId, DATE(ds.workDate) AS workDate, ws.name AS shiftName
    FROM doctorschedule ds
    JOIN workshift ws ON ws.id = ds.shiftId
    WHERE ds.doctorId = 14
    ORDER BY ds.workDate DESC
    LIMIT 10
  `)
  console.log('Doctor 14 schedules:', scheds.length)
  scheds.forEach(s => console.log(' ', JSON.stringify(s, (k,v)=>typeof v==='bigint'?Number(v):v)))

  const month = '2026-06'
  const [yr, mo] = month.split('-').map(Number)
  const start = new Date(yr, mo-1, 1).toISOString().slice(0,19).replace('T',' ')
  const end   = new Date(yr, mo, 0, 23, 59, 59).toISOString().slice(0,19).replace('T',' ')
  console.log(`\nSchedules for ${month} (${start} to ${end}):`)
  const monthly = await p.$queryRawUnsafe(`
    SELECT ds.id, DATE(ds.workDate) AS workDate, ws.name
    FROM doctorschedule ds
    JOIN workshift ws ON ws.id = ds.shiftId
    WHERE ds.doctorId = 14 AND ds.workDate BETWEEN '${start}' AND '${end}'
    ORDER BY ds.workDate
  `)
  console.log('  count:', monthly.length)
  monthly.forEach(s => console.log('  ', JSON.stringify(s, (k,v)=>typeof v==='bigint'?Number(v):v)))
}
main().catch(e=>console.error(e)).finally(()=>p.$disconnect())
