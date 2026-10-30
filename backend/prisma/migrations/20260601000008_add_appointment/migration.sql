-- CreateTable: Appointment
CREATE TABLE `Appointment` (
  `id`              INTEGER       NOT NULL AUTO_INCREMENT,
  `code`            VARCHAR(191)  NOT NULL,
  `patientName`     VARCHAR(191)  NOT NULL,
  `patientPhone`    VARCHAR(191)  NOT NULL,
  `patientDob`      DATETIME(3)   NULL,
  `patientGender`   VARCHAR(191)  NULL,
  `note`            LONGTEXT      NULL,
  `cancelReason`    LONGTEXT      NULL,
  `doctorId`        INTEGER       NULL,
  `serviceId`       INTEGER       NULL,
  `appointmentDate` DATETIME(3)   NOT NULL,
  `status`          VARCHAR(191)  NOT NULL DEFAULT 'PENDING',
  `createdBy`       INTEGER       NULL,
  `createdAt`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`       DATETIME(3)   NOT NULL,

  UNIQUE INDEX `Appointment_code_key`(`code`),
  INDEX `Appointment_appointmentDate_idx`(`appointmentDate`),
  INDEX `Appointment_status_idx`(`status`),
  INDEX `Appointment_patientPhone_idx`(`patientPhone`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Appointment`
  ADD CONSTRAINT `Appointment_doctorId_fkey`
  FOREIGN KEY (`doctorId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Appointment`
  ADD CONSTRAINT `Appointment_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Appointment`
  ADD CONSTRAINT `Appointment_createdBy_fkey`
  FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
