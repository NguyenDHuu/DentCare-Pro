-- CreateTable: invoice
CREATE TABLE `invoice` (
  `id`              INT           NOT NULL AUTO_INCREMENT,
  `code`            VARCHAR(191)  NOT NULL,
  `receptionId`     INT           NOT NULL,
  `dentalRecordId`  INT           NOT NULL,
  `patientId`       INT           NOT NULL,
  `doctorId`        INT           NOT NULL,
  `subtotal`        INT           NOT NULL DEFAULT 0,
  `discountAmount`  INT           NOT NULL DEFAULT 0,
  `discountPct`     DOUBLE        NOT NULL DEFAULT 0,
  `voucherCode`     VARCHAR(191)  NULL,
  `totalAmount`     INT           NOT NULL DEFAULT 0,
  `bhytAmount`      INT           NOT NULL DEFAULT 0,
  `paymentMethod`   VARCHAR(191)  NULL,
  `paymentNote`     VARCHAR(191)  NULL,
  `paidAt`          DATETIME(3)   NULL,
  `notes`           TEXT          NULL,
  `status`          VARCHAR(191)  NOT NULL DEFAULT 'WAITING_PAYMENT',
  `confirmedBy`     INT           NULL,
  `createdAt`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `invoice_code_key`           (`code`),
  UNIQUE INDEX `invoice_receptionId_key`    (`receptionId`),
  UNIQUE INDEX `invoice_dentalRecordId_key` (`dentalRecordId`),
  INDEX `invoice_patientId_idx`   (`patientId`),
  INDEX `invoice_doctorId_idx`    (`doctorId`),
  INDEX `invoice_status_idx`      (`status`),
  INDEX `invoice_createdAt_idx`   (`createdAt`),
  INDEX `invoice_paidAt_idx`      (`paidAt`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: invoice_item
CREATE TABLE `invoice_item` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `invoiceId`   INT           NOT NULL,
  `serviceId`   INT           NOT NULL,
  `serviceName` VARCHAR(191)  NOT NULL,
  `toothNumber` VARCHAR(191)  NULL,
  `unitPrice`   INT           NOT NULL DEFAULT 0,
  `quantity`    INT           NOT NULL DEFAULT 1,
  `bhytCovered` BOOLEAN       NOT NULL DEFAULT false,
  `amount`      INT           NOT NULL DEFAULT 0,
  `note`        VARCHAR(191)  NULL,

  INDEX `invoice_item_invoiceId_idx` (`invoiceId`),
  INDEX `invoice_item_serviceId_idx` (`serviceId`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `invoice` ADD CONSTRAINT `invoice_receptionId_fkey`
  FOREIGN KEY (`receptionId`) REFERENCES `reception`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `invoice` ADD CONSTRAINT `invoice_dentalRecordId_fkey`
  FOREIGN KEY (`dentalRecordId`) REFERENCES `dental_record`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `invoice` ADD CONSTRAINT `invoice_patientId_fkey`
  FOREIGN KEY (`patientId`) REFERENCES `patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `invoice` ADD CONSTRAINT `invoice_doctorId_fkey`
  FOREIGN KEY (`doctorId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `invoice` ADD CONSTRAINT `invoice_confirmedBy_fkey`
  FOREIGN KEY (`confirmedBy`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `invoice_item` ADD CONSTRAINT `invoice_item_invoiceId_fkey`
  FOREIGN KEY (`invoiceId`) REFERENCES `invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `invoice_item` ADD CONSTRAINT `invoice_item_serviceId_fkey`
  FOREIGN KEY (`serviceId`) REFERENCES `service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
