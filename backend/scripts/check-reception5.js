const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
p.$queryRawUnsafe('SELECT id, code, status, doctorId FROM reception ORDER BY id').then(r => {
  console.log('All receptions:')
  r.forEach(x => console.log(JSON.stringify(x, (k,v) => typeof v==='bigint'?Number(v):v)))
}).finally(()=>p.$disconnect())
