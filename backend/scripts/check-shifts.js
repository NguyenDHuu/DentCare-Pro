const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
  const shifts = await p.$queryRawUnsafe(`SELECT id, name, startTime, endTime FROM workshift ORDER BY startTime`)
  console.log('Workshifts:')
  shifts.forEach(s => console.log(JSON.stringify(s, (k,v)=>typeof v==='bigint'?Number(v):v)))

  const cols = await p.$queryRawUnsafe(`SHOW COLUMNS FROM reception`)
  console.log('\nReception columns:')
  cols.forEach(c => console.log(' ', c.Field, '-', c.Type, '- NULL:', c.Null))
}
main().catch(e=>console.error(e)).finally(()=>p.$disconnect())
