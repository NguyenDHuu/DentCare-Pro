-- AlterTable: thêm duration (thời lượng thực hiện dịch vụ, phút, 0 = chưa cấu hình)
ALTER TABLE `Service`
  ADD COLUMN `duration` INTEGER NOT NULL DEFAULT 0 AFTER `description`;
