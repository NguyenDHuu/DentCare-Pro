-- CreateTable: dental_record
CREATE TABLE `dental_record` (
  `id`               INT          NOT NULL AUTO_INCREMENT,
  `code`             VARCHAR(191) NOT NULL,
  `receptionId`      INT          NOT NULL,
  `patientId`        INT          NOT NULL,
  `doctorId`         INT          NOT NULL,
  `visitReason`      TEXT         NULL,
  `symptoms`         TEXT         NULL,
  `icd10Code`        VARCHAR(191) NULL,
  `icd10Description` VARCHAR(191) NULL,
  `clinicalNotes`    TEXT         NULL,
  `aftercareNotes`   TEXT         NULL,
  `followUpDate`     DATETIME(3)  NULL,
  `status`           VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
  `signedAt`         DATETIME(3)  NULL,
  `createdAt`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `dental_record_code_key` (`code`),
  UNIQUE KEY `dental_record_receptionId_key` (`receptionId`),
  INDEX `dental_record_patientId_idx` (`patientId`),
  INDEX `dental_record_doctorId_idx`  (`doctorId`),
  INDEX `dental_record_status_idx`    (`status`),
  CONSTRAINT `dental_record_receptionId_fkey` FOREIGN KEY (`receptionId`) REFERENCES `reception` (`id`),
  CONSTRAINT `dental_record_patientId_fkey`   FOREIGN KEY (`patientId`)   REFERENCES `patient`   (`id`),
  CONSTRAINT `dental_record_doctorId_fkey`    FOREIGN KEY (`doctorId`)    REFERENCES `user`      (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: dental_record_service
CREATE TABLE `dental_record_service` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `recordId`    INT          NOT NULL,
  `serviceId`   INT          NOT NULL,
  `toothNumber` VARCHAR(191) NULL,
  `unitPrice`   INT          NOT NULL DEFAULT 0,
  `quantity`    INT          NOT NULL DEFAULT 1,
  `note`        VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  INDEX `dental_record_service_recordId_idx`  (`recordId`),
  INDEX `dental_record_service_serviceId_idx` (`serviceId`),
  CONSTRAINT `dental_record_service_recordId_fkey`  FOREIGN KEY (`recordId`)  REFERENCES `dental_record` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dental_record_service_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `service`       (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
