/**
 * migrate-complexity.js
 * Tạo bảng patientcomplexity + seed demo data cho UC4.3
 *
 * patientcomplexity:
 *   - Mỗi bản ghi ứng với 1 ca tiếp đón (reception)
 *   - Doctor đề xuất hệ số (proposedCoeff 0.1-0.5)
 *   - Admin phê duyệt (approvedCoeff, status APPROVED)
 *   - status: NORMAL | PENDING | APPROVED
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // ── 1. Create table ────────────────────────────────────────
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS patientcomplexity (
      id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
      receptionId     INT          NOT NULL,
      proposedCoeff   DECIMAL(3,1) NOT NULL DEFAULT 0,
      proposedReason  TEXT         NULL,
      proposedBy      INT          NULL,
      proposedAt      DATETIME(3)  NULL,
      approvedCoeff   DECIMAL(3,1) NULL,
      approvedBy      INT          NULL,
      approvedAt      DATETIME(3)  NULL,
      status          VARCHAR(20)  NOT NULL DEFAULT 'NORMAL',
      createdAt       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                        ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_pc_reception (receptionId),
      INDEX pc_proposedBy_idx (proposedBy),
      INDEX pc_approvedBy_idx (approvedBy),
      CONSTRAINT pc_reception_fkey  FOREIGN KEY (receptionId) REFERENCES reception(id),
      CONSTRAINT pc_proposedBy_fkey FOREIGN KEY (proposedBy)  REFERENCES \`user\`(id),
      CONSTRAINT pc_approvedBy_fkey FOREIGN KEY (approvedBy)  REFERENCES \`user\`(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  console.log('✓ patientcomplexity table ready')

  // ── 2. Seed demo complexity records ────────────────────────
  // Lấy các reception có dental_record (đã khám), kèm bác sĩ
  const receptions = await prisma.$queryRawUnsafe(`
    SELECT r.id, r.code, r.doctorId, u.fullName AS doctorName
    FROM reception r
    JOIN dental_record dr ON dr.receptionId = r.id
    JOIN \`user\` u ON u.id = r.doctorId
    WHERE r.doctorId IS NOT NULL
      AND r.status IN ('COMPLETED', 'IN_TREATMENT', 'WAITING_PAYMENT')
    ORDER BY r.arrivedAt DESC
    LIMIT 30
  `)

  console.log('  Reception count found:', receptions.length, JSON.stringify(receptions.map(r=>({id:Number(r.id),code:r.code}))))
  if (receptions.length === 0) {
    console.log('  (Không có reception đã khám để seed — bỏ qua demo data)')
    return
  }

  // Lấy admin làm approvedBy
  const [admin] = await prisma.$queryRawUnsafe(`
    SELECT u.id FROM \`user\` u
    JOIN userrole ur ON ur.userId = u.id
    JOIN role r ON r.id = ur.roleId
    WHERE r.name = 'ADMIN' LIMIT 1
  `)
  const adminId = admin?.id ?? null

  const complexReasons = [
    'Răng khôn mọc ngang, cần mở xương',
    'Ống tủy cong phức tạp, nhiều chân',
    'Mô lợi viêm nặng cần phẫu thuật',
    'Bệnh nhân lo lắng cao, cần gây tê nhiều',
    'Tình trạng vệ sinh răng miệng kém, nhiều mảng bám',
    'Răng sâu ăn sâu gần tủy',
    'Phục hình phức tạp nhiều vị trí',
  ]

  let seeded = 0, skipped = 0

  for (let i = 0; i < receptions.length; i++) {
    const r = receptions[i]
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM patientcomplexity WHERE receptionId = ${r.id} LIMIT 1`
    )
    if (existing[0]) { skipped++; continue }

    // ~50% ca là phức tạp (dùng index chẵn/lẻ để đảm bảo có ít nhất vài ca)
    const isComplex = i % 2 === 0
    if (!isComplex) continue

    // Hệ số 0.1 – 0.5 (đa số 0.2-0.3)
    const coeffOptions = [0.1, 0.2, 0.2, 0.3, 0.3, 0.4, 0.5]
    const coeff  = coeffOptions[(i + Number(r.id)) % coeffOptions.length]
    const reason = complexReasons[(i + Number(r.id)) % complexReasons.length]

    // ~60% đã duyệt, ~40% chờ duyệt
    const isApproved = (i + Number(r.id)) % 3 !== 0
    const status = isApproved ? 'APPROVED' : 'PENDING'

    await prisma.$executeRawUnsafe(`
      INSERT IGNORE INTO patientcomplexity
        (receptionId, proposedCoeff, proposedReason, proposedBy, proposedAt,
         approvedCoeff, approvedBy, approvedAt, status)
      VALUES
        (${r.id}, ${coeff}, '${reason.replace(/'/g, "\\'")}', ${r.doctorId}, NOW() - INTERVAL ${i+1} DAY,
         ${isApproved ? coeff : 'NULL'}, ${isApproved && adminId ? adminId : 'NULL'},
         ${isApproved ? `NOW() - INTERVAL ${i} DAY` : 'NULL'},
         '${status}')
    `)
    seeded++
  }

  console.log(`✓ Seeded ${seeded} complexity records (${skipped} skipped)`)
  console.log('  Done.')
}

main()
  .catch(e => console.error('ERR:', e.message))
  .finally(() => prisma.$disconnect())
