const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 1. Revert fixedsalary: drop role col, add userId back
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE fixedsalary DROP COLUMN role`)
    console.log('Dropped role column from fixedsalary')
  } catch(e) { console.log('Drop role skipped:', e.message) }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE fixedsalary ADD COLUMN userId INT NOT NULL DEFAULT 0 AFTER id`)
    console.log('Added userId column to fixedsalary')
  } catch(e) { console.log('Add userId skipped:', e.message) }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE fixedsalary ADD CONSTRAINT FixedSalary_userId_fkey FOREIGN KEY (userId) REFERENCES \`user\`(id)`)
    console.log('Added FK')
  } catch(e) { console.log('Add FK skipped:', e.message) }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE fixedsalary ADD INDEX FixedSalary_userId_fkey (userId)`)
    console.log('Added index')
  } catch(e) { console.log('Add index skipped:', e.message) }

  // 2. Create allowance table
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS allowance (
        id        INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name      VARCHAR(100) NOT NULL,
        amount    INT          NOT NULL,
        appliesTo VARCHAR(20)  NOT NULL DEFAULT 'BOTH',
        startDate DATETIME(3)  NOT NULL,
        endDate   DATETIME(3)  NULL,
        createdBy INT          NULL,
        createdAt DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updatedAt DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX Allowance_createdBy_fkey (createdBy)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('Created allowance table')
  } catch(e) { console.log('Create allowance skipped:', e.message) }

  // 3. Add FK on allowance after table exists (separate step)
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE allowance ADD CONSTRAINT Allowance_createdBy_fkey FOREIGN KEY (createdBy) REFERENCES \`user\`(id)`)
    console.log('Added allowance FK')
  } catch(e) { console.log('allowance FK skipped:', e.message) }

  const cols1 = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM fixedsalary`)
  const cols2 = await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM allowance`)
  console.log('fixedsalary:', cols1.map(c => c.Field).join(', '))
  console.log('allowance  :', cols2.map(c => c.Field).join(', '))
}

main().catch(e => console.error('ERR:', e.message)).finally(() => prisma.$disconnect())
