-- AlterTable: add secretKey to SmsConfig
ALTER TABLE `SmsConfig` ADD COLUMN `secretKey` LONGTEXT NULL;
