-- CreateTable
CREATE TABLE `WorkShift` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `slotDuration` INTEGER NOT NULL,
    `maxPatients` INTEGER NOT NULL,
    `applyDays` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `colorCode` VARCHAR(191) NOT NULL DEFAULT 'blue',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WorkShift_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
