-- CreateTable: ngày nghỉ lễ (UC07)
CREATE TABLE `Holiday` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(191) NOT NULL,
  `startDate`   DATETIME(3) NOT NULL,
  `endDate`     DATETIME(3) NOT NULL,
  `type`        VARCHAR(191) NOT NULL DEFAULT 'NATIONAL',
  `sendSms`     BOOLEAN NOT NULL DEFAULT false,
  `autoCancel`  BOOLEAN NOT NULL DEFAULT false,
  `createdBy`   INT NULL,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `Holiday_startDate_idx` (`startDate`),
  CONSTRAINT `Holiday_createdBy_fkey`
    FOREIGN KEY (`createdBy`) REFERENCES `User` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
