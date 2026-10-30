/**
 * Test the exact query used in getDoctorComplexityCases
 */
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const doctorId = 14
  const yr = 2026
  const mo = 6

  console.log(`Testing query for doctor ${doctorId}, month ${yr}-${String(mo).padStart(2,'0')}`)

  // Test 1: Direct reception query (no date filter)
  const allRecs = await p.$queryRawUnsafe(`
    SELECT r.id, r.code, r.status, r.arrivedAt, r.doctorId
    FROM reception r
    WHERE r.doctorId = ${doctorId}
    ORDER BY r.arrivedAt
  `)
  console.log('\n[1] All receptions for doctor 14:')
  allRecs.forEach(r => console.log('  ', JSON.stringify(r, (k,v)=>typeof v==='bigint'?Number(v):v)))

  // Test 2: With YEAR/MONTH filter
  const filtered = await p.$queryRawUnsafe(`
    SELECT r.id, r.code, r.status,
      YEAR(r.arrivedAt) AS yr, MONTH(r.arrivedAt) AS mo,
      DATE_FORMAT(r.arrivedAt, '%Y-%m-%d') AS workDate
    FROM reception r
    WHERE r.doctorId = ${doctorId}
      AND YEAR(r.arrivedAt)  = ${yr}
      AND MONTH(r.arrivedAt) = ${mo}
      AND r.status IN ('COMPLETED','IN_TREATMENT','WAITING_PAYMENT','DONE')
  `)
  console.log('\n[2] With YEAR/MONTH filter (yr=2026, mo=6):')
  console.log('  count:', filtered.length)
  filtered.forEach(r => console.log('  ', JSON.stringify(r, (k,v)=>typeof v==='bigint'?Number(v):v)))

  // Test 3: With patientcomplexity join
  const withComplex = await p.$queryRawUnsafe(`
    SELECT
      r.id AS receptionId, r.code AS receptionCode,
      DATE_FORMAT(r.arrivedAt, '%Y-%m-%d') AS workDate,
      p.fullName AS patientName,
      CAST(pc.proposedCoeff AS DECIMAL(3,1)) AS proposedCoeff,
      pc.status AS complexStatus
    FROM reception r
    JOIN patient p ON p.id = r.patientId
    LEFT JOIN patientcomplexity pc ON pc.receptionId = r.id
    WHERE r.doctorId = ${doctorId}
      AND YEAR(r.arrivedAt)  = ${yr}
      AND MONTH(r.arrivedAt) = ${mo}
      AND r.status IN ('COMPLETED','IN_TREATMENT','WAITING_PAYMENT','DONE')
    ORDER BY r.arrivedAt
  `)
  console.log('\n[3] Full query result:')
  console.log('  count:', withComplex.length)
  withComplex.forEach(r => console.log('  ', JSON.stringify(r, (k,v)=>typeof v==='bigint'?Number(v):v)))
}

main().catch(e => console.error('ERR:', e.message)).finally(() => p.$disconnect())
