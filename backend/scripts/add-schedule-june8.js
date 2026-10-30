/**
 * Seed 1 doctor schedule cho ngày 2026-06-08 (ngày có tất cả reception data)
 */
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Lấy Ca sáng shift id
  const [shift] = await p.$queryRawUnsafe(`SELECT id, name FROM workshift WHERE name LIKE '%sáng%' LIMIT 1`)
  if (!shift) { console.log('No morning shift found'); return }
  console.log('Using shift:', JSON.stringify(shift, (k,v)=>typeof v==='bigint'?Number(v):v))

  // Kiểm tra đã có chưa
  const existing = await p.$queryRawUnsafe(`
    SELECT id FROM doctorschedule WHERE doctorId = 14 AND DATE(workDate) = '2026-06-08' LIMIT 1
  `)
  if (existing[0]) {
    console.log('Schedule for June 8 already exists:', JSON.stringify(existing[0], (k,v)=>typeof v==='bigint'?Number(v):v))
    return
  }

  await p.$executeRawUnsafe(`
    INSERT INTO doctorschedule (doctorId, shiftId, workDate, createdAt, updatedAt)
    VALUES (14, ${Number(shift.id)}, '2026-06-08 00:00:00.000', NOW(), NOW())
  `)
  console.log('✓ Added schedule for doctor 14 on 2026-06-08 (Ca sáng)')
}

main().catch(e=>console.error('ERR:', e.message)).finally(()=>p.$disconnect())
