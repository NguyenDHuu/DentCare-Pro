/**
 * migrate-reception-schedule.js
 * 1. Thêm cột scheduleId vào bảng reception (FK -> doctorschedule)
 * 2. Sửa schedule ngày 08/06 từ Ca sáng → Ca chiều (khớp với giờ tiếp đón thực tế 13:xx VN)
 * 3. Backfill scheduleId cho tất cả reception cũ bằng cách match time range (VN+7)
 */
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // ── 1. Add scheduleId column ──────────────────────────────────
  const cols = await p.$queryRawUnsafe(`SHOW COLUMNS FROM reception LIKE 'scheduleId'`)
  if (cols.length === 0) {
    await p.$executeRawUnsafe(`
      ALTER TABLE reception
        ADD COLUMN scheduleId INT NULL AFTER doctorId,
        ADD CONSTRAINT reception_scheduleId_fkey
          FOREIGN KEY (scheduleId) REFERENCES doctorschedule(id) ON DELETE SET NULL
    `)
    console.log('✓ Added scheduleId column to reception')
  } else {
    console.log('  scheduleId column already exists')
  }

  // ── 2. Fix seed schedule: change June 8 from Ca sáng → Ca chiều ──
  const [caChieu] = await p.$queryRawUnsafe(
    `SELECT id FROM workshift WHERE name LIKE '%chiều%' LIMIT 1`
  )
  if (!caChieu) { console.error('Ca chiều shift not found!'); return }

  const updated = await p.$executeRawUnsafe(`
    UPDATE doctorschedule
    SET shiftId = ${Number(caChieu.id)}
    WHERE id = 16
      AND DATE(workDate) = '2026-06-08'
  `)
  console.log(`✓ Updated schedule #16 to Ca chiều (shiftId=${Number(caChieu.id)}), rows=${updated}`)

  // ── 3. Backfill scheduleId for all existing receptions ────────
  // Match: doctorId + VN date (arrivedAt+7h) + time range (VN time BETWEEN startTime AND endTime)
  // If no exact shift match on that date, fall back to any schedule on that date (nearest shift)
  const backfilled = await p.$executeRawUnsafe(`
    UPDATE reception r
    JOIN (
      SELECT r2.id AS recId, ds.id AS schedId
      FROM reception r2
      JOIN doctorschedule ds
        ON ds.doctorId = r2.doctorId
        AND DATE(ADDTIME(ds.workDate, '07:00:00')) = DATE(ADDTIME(r2.arrivedAt, '07:00:00'))
      JOIN workshift ws
        ON ws.id = ds.shiftId
        AND TIME(ADDTIME(r2.arrivedAt, '07:00:00')) BETWEEN ws.startTime AND ws.endTime
      WHERE r2.doctorId IS NOT NULL
    ) m ON m.recId = r.id
    SET r.scheduleId = m.schedId
    WHERE r.scheduleId IS NULL
  `)
  console.log(`✓ Backfilled scheduleId for ${backfilled} receptions (exact time match)`)

  // Fall back: if still NULL, assign any schedule on same VN date
  const fallback = await p.$executeRawUnsafe(`
    UPDATE reception r
    JOIN (
      SELECT r2.id AS recId, MIN(ds.id) AS schedId
      FROM reception r2
      JOIN doctorschedule ds
        ON ds.doctorId = r2.doctorId
        AND DATE(ADDTIME(ds.workDate, '07:00:00')) = DATE(ADDTIME(r2.arrivedAt, '07:00:00'))
      WHERE r2.doctorId IS NOT NULL AND r2.scheduleId IS NULL
      GROUP BY r2.id
    ) m ON m.recId = r.id
    SET r.scheduleId = m.schedId
    WHERE r.scheduleId IS NULL
  `)
  console.log(`✓ Fallback: assigned ${fallback} more receptions (nearest schedule same day)`)

  // Verify
  const result = await p.$queryRawUnsafe(`
    SELECT r.id, r.code, r.scheduleId, ws.name AS shiftName,
           HOUR(ADDTIME(r.arrivedAt,'07:00:00')) AS h_vn,
           MINUTE(ADDTIME(r.arrivedAt,'07:00:00')) AS m_vn
    FROM reception r
    LEFT JOIN doctorschedule ds ON ds.id = r.scheduleId
    LEFT JOIN workshift ws ON ws.id = ds.shiftId
    WHERE r.doctorId IS NOT NULL
    ORDER BY r.id
  `)
  console.log('\nVerification — reception ↔ schedule mapping:')
  result.forEach(r => {
    const vn = `${r.h_vn}:${String(r.m_vn).padStart(2,'0')}`
    console.log(`  ${r.code} VN=${vn} → schedId=${r.scheduleId} shift=${r.shiftName}`)
  })

  console.log('\n✓ Done.')
}

main()
  .catch(e => console.error('ERR:', e.message))
  .finally(() => p.$disconnect())
