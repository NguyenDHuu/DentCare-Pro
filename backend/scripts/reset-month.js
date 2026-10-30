const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
const month = process.argv[2] || '2026-06'
p.$executeRawUnsafe(`DELETE FROM payslip WHERE month = '${month}'`)
  .then(r => console.log(`Deleted rows for ${month}:`, r))
  .finally(() => p.$disconnect())
