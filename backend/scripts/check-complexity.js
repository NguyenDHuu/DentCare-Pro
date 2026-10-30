const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

p.$queryRawUnsafe(
  `SELECT pc.id, pc.receptionId, r.code, CAST(pc.proposedCoeff AS CHAR) AS proposed,
   CAST(pc.approvedCoeff AS CHAR) AS approved, pc.status, pc.proposedReason
   FROM patientcomplexity pc
   JOIN reception r ON r.id = pc.receptionId
   LIMIT 20`
)
.then(rows => {
  console.log(`Found ${rows.length} records:`)
  rows.forEach(r => console.log(JSON.stringify(r)))
})
.catch(e => console.error('ERR:', e.message))
.finally(() => p.$disconnect())
