const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS shiftcoefficient (
      id          INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
      shiftId     INT           NOT NULL,
      dayOfWeek   TINYINT       NOT NULL COMMENT '1=Thứ Hai … 7=Chủ nhật',
      coefficient DECIMAL(4,2)  NOT NULL DEFAULT 1.00,
      updatedBy   INT           NULL,
      updatedAt   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_shift_day (shiftId, dayOfWeek),
      INDEX ShiftCoefficient_shiftId_fkey (shiftId),
      INDEX ShiftCoefficient_updatedBy_fkey (updatedBy),
      CONSTRAINT ShiftCoefficient_shiftId_fkey   FOREIGN KEY (shiftId)   REFERENCES workshift(\`id\`),
      CONSTRAINT ShiftCoefficient_updatedBy_fkey FOREIGN KEY (updatedBy) REFERENCES \`user\`(\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log('Created shiftcoefficient table')

  const cols = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM shiftcoefficient`)
  console.log('Columns:', cols.map(c => c.Field).join(', '))
}

main().catch(e => console.error('ERR:', e.message)).finally(() => prisma.$disconnect())
