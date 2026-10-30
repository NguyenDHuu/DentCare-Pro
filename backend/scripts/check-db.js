const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
const s = (v) => (typeof v === 'bigint' ? Number(v) : v)
const j = (v) => JSON.stringify(v, (k, val) => typeof val === 'bigint' ? Number(val) : val)
async function main() {
  const q = "SELECT r.id, r.code, r.doctorId, dr.id as drId FROM reception r LEFT JOIN dental_record dr ON dr.receptionId=r.id WHERE r.status IN ('COMPLETED','IN_TREATMENT','WAITING_PAYMENT') LIMIT 10"
  const r1 = await p.$queryRawUnsafe(q)
  console.log('Reception+DR join:', j(r1))
  const r2 = await p.$queryRawUnsafe('SELECT id, receptionId, doctorId FROM dental_record LIMIT 5')
  console.log('DentalRecords:', j(r2))
  const r3 = await p.$queryRawUnsafe("SELECT id, doctorId, shiftId, workDate FROM doctorschedule WHERE workDate >= '2026-06-01' AND workDate <= '2026-06-30' ORDER BY workDate LIMIT 5")
  console.log('DoctorSchedules:', j(r3))
}
main().catch(e => console.error(e.message)).finally(() => p.$disconnect())
