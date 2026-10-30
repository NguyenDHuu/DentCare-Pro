const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function run() {
  try {
    await p.$executeRawUnsafe(
      'ALTER TABLE holiday ADD COLUMN startTime VARCHAR(5) NULL, ADD COLUMN endTime VARCHAR(5) NULL'
    )
    console.log('✓ Columns added successfully')
  } catch (e) {
    if (e.message && e.message.includes('Duplicate column')) {
      console.log('Columns already exist, skipping.')
    } else {
      console.error('Error:', e.message)
      process.exit(1)
    }
  } finally {
    await p.$disconnect()
  }
}

run()
