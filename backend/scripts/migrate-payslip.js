const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // ── 1. Create payslip table ───────────────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS payslip (
      id           INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
      userId       INT           NOT NULL,
      month        VARCHAR(7)    NOT NULL COMMENT 'YYYY-MM',
      role         VARCHAR(20)   NOT NULL,
      sessionCount INT           NULL     COMMENT 'Bác sĩ: số ca trực',
      hoursWorked  DECIMAL(6,2)  NULL     COMMENT 'Bác sĩ: tổng giờ quy đổi',
      salaryAmount INT           NOT NULL DEFAULT 0,
      allowance    INT           NOT NULL DEFAULT 0,
      deduction    INT           NOT NULL DEFAULT 0,
      netSalary    INT           NOT NULL DEFAULT 0,
      status       VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
      note         TEXT          NULL,
      createdBy    INT           NULL,
      createdAt    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_user_month (userId, month),
      INDEX Payslip_month_idx (month),
      INDEX Payslip_userId_fkey (userId),
      INDEX Payslip_createdBy_fkey (createdBy),
      CONSTRAINT Payslip_userId_fkey    FOREIGN KEY (userId)    REFERENCES \`user\`(id),
      CONSTRAINT Payslip_createdBy_fkey FOREIGN KEY (createdBy) REFERENCES \`user\`(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log('✓ payslip table ready')

  // ── 2. Seed demo data for 2026-06 ─────────────────────────────
  const existing = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM payslip WHERE month = '2026-06'`)
  if (Number(existing[0].cnt) > 0) { console.log('✓ seed data already exists, skipping'); return }

  // Get active users by role
  const getUsers = async (roleName) => prisma.$queryRawUnsafe(`
    SELECT u.id, u.fullName FROM \`user\` u
    JOIN userrole ur ON ur.userId = u.id
    JOIN role r ON r.id = ur.roleId
    WHERE u.isActive = 1 AND r.name = '${roleName}'
    ORDER BY u.id ASC LIMIT 5
  `)

  const doctors      = await getUsers('DOCTOR')
  const receptionists = await getUsers('RECEPTIONIST')
  const accountants  = await getUsers('ACCOUNTANT')

  // Find any admin user as createdBy
  const admins = await prisma.$queryRawUnsafe(`
    SELECT u.id FROM \`user\` u JOIN userrole ur ON ur.userId = u.id
    JOIN role r ON r.id = ur.roleId WHERE r.name = 'ADMIN' LIMIT 1
  `)
  const createdBy = admins[0]?.id ?? null

  const month = '2026-06'
  let count = 0

  // Doctor payslip templates
  const doctorTemplates = [
    { sessionCount: 5,  hoursWorked: 33.9, salaryAmount: 11509000, allowance: 500000,  deduction: 0,       status: 'FINALIZED' },
    { sessionCount: 2,  hoursWorked: 10.4, salaryAmount: 3120000,  allowance: 0,        deduction: 200000,  status: 'APPROVED'  },
    { sessionCount: 4,  hoursWorked: 22.0, salaryAmount: 7480000,  allowance: 300000,  deduction: 0,       status: 'DRAFT'     },
    { sessionCount: 6,  hoursWorked: 40.5, salaryAmount: 14200000, allowance: 600000,  deduction: 300000,  status: 'FINALIZED' },
    { sessionCount: 3,  hoursWorked: 18.0, salaryAmount: 6300000,  allowance: 200000,  deduction: 0,       status: 'APPROVED'  },
  ]
  const receptionistTemplates = [
    { salaryAmount: 8000000,  allowance: 200000, deduction: 0,       status: 'FINALIZED' },
    { salaryAmount: 7500000,  allowance: 0,       deduction: 500000, status: 'FINALIZED' },
    { salaryAmount: 8500000,  allowance: 300000, deduction: 0,       status: 'APPROVED'  },
  ]
  const accountantTemplates = [
    { salaryAmount: 10000000, allowance: 500000, deduction: 0,       status: 'APPROVED'  },
    { salaryAmount: 9500000,  allowance: 0,       deduction: 0,      status: 'DRAFT'     },
    { salaryAmount: 11000000, allowance: 400000, deduction: 200000,  status: 'FINALIZED' },
  ]

  for (let i = 0; i < doctors.length; i++) {
    const u = doctors[i]
    const t = doctorTemplates[i % doctorTemplates.length]
    const net = t.salaryAmount + t.allowance - t.deduction
    await prisma.$executeRawUnsafe(`
      INSERT IGNORE INTO payslip (userId, month, role, sessionCount, hoursWorked, salaryAmount, allowance, deduction, netSalary, status, createdBy)
      VALUES (${u.id}, '${month}', 'DOCTOR', ${t.sessionCount}, ${t.hoursWorked}, ${t.salaryAmount}, ${t.allowance}, ${t.deduction}, ${net}, '${t.status}', ${createdBy ?? 'NULL'})
    `)
    count++
  }
  for (let i = 0; i < receptionists.length; i++) {
    const u = receptionists[i]
    const t = receptionistTemplates[i % receptionistTemplates.length]
    const net = t.salaryAmount + t.allowance - t.deduction
    await prisma.$executeRawUnsafe(`
      INSERT IGNORE INTO payslip (userId, month, role, salaryAmount, allowance, deduction, netSalary, status, createdBy)
      VALUES (${u.id}, '${month}', 'RECEPTIONIST', ${t.salaryAmount}, ${t.allowance}, ${t.deduction}, ${net}, '${t.status}', ${createdBy ?? 'NULL'})
    `)
    count++
  }
  for (let i = 0; i < accountants.length; i++) {
    const u = accountants[i]
    const t = accountantTemplates[i % accountantTemplates.length]
    const net = t.salaryAmount + t.allowance - t.deduction
    await prisma.$executeRawUnsafe(`
      INSERT IGNORE INTO payslip (userId, month, role, salaryAmount, allowance, deduction, netSalary, status, createdBy)
      VALUES (${u.id}, '${month}', 'ACCOUNTANT', ${t.salaryAmount}, ${t.allowance}, ${t.deduction}, ${net}, '${t.status}', ${createdBy ?? 'NULL'})
    `)
    count++
  }

  console.log(`✓ seeded ${count} payslips for ${month}`)
  console.log(`  Doctors: ${doctors.length}, Receptionists: ${receptionists.length}, Accountants: ${accountants.length}`)
}

main().catch(e => console.error('ERR:', e.message)).finally(() => prisma.$disconnect())
