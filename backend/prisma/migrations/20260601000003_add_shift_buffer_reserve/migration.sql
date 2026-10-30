-- AlterTable: thêm bufferTime (đệm giữa lịch hẹn) và reserveSlots (slot dự phòng)
ALTER TABLE `WorkShift`
  ADD COLUMN `bufferTime`   INTEGER NOT NULL DEFAULT 0 AFTER `slotDuration`,
  ADD COLUMN `reserveSlots` INTEGER NOT NULL DEFAULT 1 AFTER `maxPatients`;
