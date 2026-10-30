const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  // Find all doctors
  const doctors = await p.$queryRawUnsafe(`
    SELECT u.id, u.fullName, u.username
    FROM \`user\` u
    JOIN userrole ur ON ur.userId = u.id
    JOIN role r ON r.id = ur.roleId
    WHERE r.name = 'DOCTOR'
    ORDER BY u.id
  `)
  console.log('All doctors:')
  doctors.forEach(d => console.log(' ', JSON.stringify(d, (k,v)=>typeof v==='bigint'?Number(v):v)))

  // Find bacsi2 specifically
  const [bacsi2] = await p.$queryRawUnsafe(`SELECT id FROM \`user\` WHERE username = 'bacsi2' LIMIT 1`)
  if (!bacsi2) { console.log('\nbacsi2 NOT found'); return }
  const docId = Number(bacsi2.id)
  console.log('\nbacsi2 id:', docId)

  // Check receptions for bacsi2
  const recs = await p.$queryRawUnsafe(`
    SELECT r.id, r.code, r.status, DATE(r.arrivedAt) AS workDate
    FROM reception r WHERE r.doctorId = ${docId}
    ORDER BY r.arrivedAt DESC LIMIT 10
  `)
  console.log('bacsi2 receptions:', recs.length)
  recs.forEach(r => console.log(' ', JSON.stringify(r, (k,v)=>typeof v==='bigint'?Number(v):v)))
}
main().catch(e=>console.error(e)).finally(()=>p.$disconnect())
