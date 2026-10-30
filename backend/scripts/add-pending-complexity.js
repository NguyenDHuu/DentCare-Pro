/**
 * Thêm 1-2 record PENDING vào patientcomplexity để test luồng duyệt
 */
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Tìm reception chưa có complexity record
  const receptions = await p.$queryRawUnsafe(`
    SELECT r.id, r.code, r.doctorId
    FROM reception r
    LEFT JOIN patientcomplexity pc ON pc.receptionId = r.id
    WHERE pc.id IS NULL
      AND r.doctorId IS NOT NULL
      AND r.status IN ('COMPLETED', 'IN_TREATMENT', 'WAITING_PAYMENT')
    LIMIT 5
  `)
  console.log('Receptions without complexity:', receptions.length, receptions.map(r=>r.code))

  for (const r of receptions) {
    await p.$executeRawUnsafe(`
      INSERT IGNORE INTO patientcomplexity
        (receptionId, proposedCoeff, proposedReason, proposedBy, proposedAt, status)
      VALUES
        (${Number(r.id)}, 0.3, 'Bệnh nhân lo lắng, khó hợp tác, cần gây tê nhiều lần', ${Number(r.doctorId)}, NOW(), 'PENDING')
    `)
    console.log('  Inserted PENDING for', r.code)
  }
  console.log('Done.')
}

main()
  .catch(e => console.error('ERR:', e.message))
  .finally(() => p.$disconnect())
