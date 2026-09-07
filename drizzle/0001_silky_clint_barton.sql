CREATE TABLE `attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`sizeBytes` int NOT NULL,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`action` varchar(96) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int,
	`beforeValue` json,
	`afterValue` json,
	`reason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billingCycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`status` enum('draft','data_entry','validation','reviewed','approved','closed') NOT NULL DEFAULT 'draft',
	`tariffVersionId` int,
	`selectedCostModel` enum('cash','full') NOT NULL DEFAULT 'cash',
	`depreciationMode` enum('accounting','operational') NOT NULL DEFAULT 'accounting',
	`maintenanceMode` enum('actual','allocated') NOT NULL DEFAULT 'actual',
	`calculationVersion` varchar(32) NOT NULL DEFAULT '1.0.0',
	`approvedBy` int,
	`approvedAt` timestamp,
	`closedBy` int,
	`closedAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billingCycles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calculationSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billingCycleId` int NOT NULL,
	`calculationType` varchar(64) NOT NULL,
	`engineVersion` varchar(32) NOT NULL,
	`inputs` json NOT NULL,
	`outputs` json NOT NULL,
	`warnings` json,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calculationSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fuelTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billingCycleId` int NOT NULL,
	`generatorId` int NOT NULL,
	`transactionType` enum('refuel','consumption','adjustment') NOT NULL,
	`quantityLiters` decimal(14,3) NOT NULL,
	`unitPrice` decimal(16,4) NOT NULL,
	`transactionAt` timestamp NOT NULL,
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fuelTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generatorRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billingCycleId` int NOT NULL,
	`generatorId` int NOT NULL,
	`startedAt` timestamp NOT NULL,
	`endedAt` timestamp NOT NULL,
	`runtimeHours` decimal(12,3) NOT NULL,
	`measurementMode` enum('kwh','kw','kva') NOT NULL,
	`directKwh` decimal(14,3),
	`averageKw` decimal(14,3),
	`averageKva` decimal(14,3),
	`powerFactor` decimal(6,4),
	`qualityStatus` enum('measured','calculated','estimated') NOT NULL DEFAULT 'measured',
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generatorRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`ratedKva` decimal(12,3),
	`defaultPowerFactor` decimal(6,4),
	`acquisitionCost` decimal(18,2),
	`residualValue` decimal(18,2) DEFAULT '0',
	`inServiceAt` timestamp,
	`usefulLifeMonths` int,
	`usefulLifeHours` decimal(14,2),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generators_id` PRIMARY KEY(`id`),
	CONSTRAINT `generator_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `maintenanceRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billingCycleId` int,
	`generatorId` int NOT NULL,
	`maintenanceType` varchar(120) NOT NULL,
	`performedAt` timestamp NOT NULL,
	`actualCost` decimal(18,2) NOT NULL,
	`expectedServiceHours` decimal(14,2),
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `maintenanceRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meterReadings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billingCycleId` int NOT NULL,
	`utilityMeterId` int NOT NULL,
	`previousReading` decimal(16,3) NOT NULL,
	`currentReading` decimal(16,3) NOT NULL,
	`multiplierSnapshot` decimal(12,4) NOT NULL,
	`readAt` timestamp NOT NULL,
	`sourceType` enum('manual','meter','invoice','imported') NOT NULL DEFAULT 'manual',
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meterReadings_id` PRIMARY KEY(`id`),
	CONSTRAINT `cycle_meter_reading_unique` UNIQUE(`billingCycleId`,`utilityMeterId`)
);
--> statement-breakpoint
CREATE TABLE `settingsVersions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingGroup` varchar(64) NOT NULL,
	`settingKey` varchar(128) NOT NULL,
	`value` json NOT NULL,
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`changeReason` varchar(255) NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `settingsVersions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tariffBrackets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tariffVersionId` int NOT NULL,
	`sequence` int NOT NULL,
	`minKwh` decimal(14,3) NOT NULL,
	`maxKwh` decimal(14,3),
	`unitRate` decimal(16,4) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tariffBrackets_id` PRIMARY KEY(`id`),
	CONSTRAINT `tariff_bracket_sequence_unique` UNIQUE(`tariffVersionId`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `tariffVersions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`pricingMode` enum('whole_cycle_rate','progressive') NOT NULL DEFAULT 'whole_cycle_rate',
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tariffVersions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `utilityInvoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billingCycleId` int NOT NULL,
	`invoiceNumber` varchar(96),
	`invoiceIssuedAt` timestamp,
	`officialKwh` decimal(16,3),
	`officialAmount` decimal(18,2) NOT NULL,
	`adjustmentAmount` decimal(18,2) NOT NULL DEFAULT '0',
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `utilityInvoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `utility_invoice_cycle_unique` UNIQUE(`billingCycleId`)
);
--> statement-breakpoint
CREATE TABLE `utilityMeters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`multiplier` decimal(12,4) NOT NULL DEFAULT '1',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `utilityMeters_id` PRIMARY KEY(`id`),
	CONSTRAINT `utility_meter_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','energy_operator','accountant','maintenance','reviewer','auditor','management') NOT NULL DEFAULT 'management';--> statement-breakpoint
CREATE INDEX `attachment_entity_idx` ON `attachments` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `auditLogs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `auditLogs` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `billing_cycle_status_idx` ON `billingCycles` (`status`);--> statement-breakpoint
CREATE INDEX `billing_cycle_period_idx` ON `billingCycles` (`periodStart`,`periodEnd`);--> statement-breakpoint
CREATE INDEX `calculation_snapshot_cycle_idx` ON `calculationSnapshots` (`billingCycleId`);--> statement-breakpoint
CREATE INDEX `fuel_transaction_cycle_idx` ON `fuelTransactions` (`billingCycleId`);--> statement-breakpoint
CREATE INDEX `generator_run_cycle_idx` ON `generatorRuns` (`billingCycleId`);--> statement-breakpoint
CREATE INDEX `generator_run_generator_idx` ON `generatorRuns` (`generatorId`);--> statement-breakpoint
CREATE INDEX `maintenance_generator_idx` ON `maintenanceRecords` (`generatorId`);--> statement-breakpoint
CREATE INDEX `settings_lookup_idx` ON `settingsVersions` (`settingGroup`,`settingKey`,`effectiveFrom`);--> statement-breakpoint
CREATE INDEX `tariff_bracket_version_idx` ON `tariffBrackets` (`tariffVersionId`);