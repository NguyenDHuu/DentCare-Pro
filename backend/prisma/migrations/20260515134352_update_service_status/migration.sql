/*
  Warnings:

  - You are about to drop the column `isActive` on the `service` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `service` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `service` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `service` DROP COLUMN `isActive`,
    DROP COLUMN `price`,
    DROP COLUMN `unit`,
    ADD COLUMN `activatedAt` DATETIME(3) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'INACTIVE',
    ADD COLUMN `usageCount` INTEGER NOT NULL DEFAULT 0;
