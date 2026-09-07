CREATE TABLE `fuelInventoryClosures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`openingBalance` decimal(14,3) NOT NULL,
	`totalReceipts` decimal(14,3) NOT NULL,
	`totalIssues` decimal(14,3) NOT NULL,
	`totalWaste` decimal(14,3) NOT NULL,
	`bookBalance` decimal(14,3) NOT NULL,
	`meterReadingStart` decimal(16,3) NOT NULL,
	`meterReadingEnd` decimal(16,3) NOT NULL,
	`quantityIssuedByMeter` decimal(14,3) NOT NULL,
	`gaugeReadingCm` decimal(12,3) NOT NULL,
	`physicalBalance` decimal(14,3) NOT NULL,
	`difference` decimal(14,3) NOT NULL,
	`resultType` enum('surplus','shortage','balanced') NOT NULL,
	`status` enum('draft','approved','closed') NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdBy` int NOT NULL,
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fuelInventoryClosures_id` PRIMARY KEY(`id`),
	CONSTRAINT `fuel_inventory_period_unique` UNIQUE(`productId`,`year`,`month`)
);
--> statement-breakpoint
CREATE TABLE `fuelIssues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`issuedAt` timestamp NOT NULL,
	`previousReading` decimal(16,3) NOT NULL,
	`currentReading` decimal(16,3) NOT NULL,
	`quantityIssued` decimal(14,3) NOT NULL,
	`temperature` decimal(6,2) NOT NULL,
	`correctedQuantity` decimal(14,3) NOT NULL,
	`issuedTo` varchar(160) NOT NULL,
	`vehicleNumber` varchar(96),
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fuelIssues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fuelProducts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(160) NOT NULL,
	`fuelType` enum('diesel','petrol','kerosene','other') NOT NULL DEFAULT 'diesel',
	`tankCapacity` decimal(14,3) NOT NULL,
	`literPerCm` decimal(14,4) NOT NULL DEFAULT '0',
	`expansionCoefficient` decimal(10,7) NOT NULL DEFAULT '0.0006500',
	`referenceTemp` decimal(6,2) NOT NULL DEFAULT '15',
	`openingBalance` decimal(14,3) NOT NULL DEFAULT '0',
	`openingDate` timestamp,
	`lastMeterReading` decimal(16,3) NOT NULL DEFAULT '0',
	`isActive` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fuelProducts_id` PRIMARY KEY(`id`),
	CONSTRAINT `fuel_product_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `fuelReceipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`supplierId` int,
	`invoiceNumber` varchar(96),
	`receivedAt` timestamp NOT NULL,
	`quantityFromTruck` decimal(14,3) NOT NULL,
	`quantityFromGauge` decimal(14,3) NOT NULL,
	`temperature` decimal(6,2) NOT NULL,
	`correctedQuantity` decimal(14,3) NOT NULL,
	`pricePerLiter` decimal(16,4) NOT NULL,
	`totalAmount` decimal(18,2) NOT NULL,
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fuelReceipts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fuelSuppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`contactName` varchar(160),
	`phone` varchar(48),
	`isActive` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fuelSuppliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `fuel_supplier_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `fuelWasteRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`quantity` decimal(14,3) NOT NULL,
	`reason` varchar(160) NOT NULL,
	`notes` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fuelWasteRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sectionRoleGrants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`section` enum('energy','fuel') NOT NULL,
	`role` enum('viewer','operator','supervisor','accountant','auditor') NOT NULL,
	`grantedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sectionRoleGrants_id` PRIMARY KEY(`id`),
	CONSTRAINT `section_role_grant_unique` UNIQUE(`userId`,`section`,`role`)
);
--> statement-breakpoint
CREATE INDEX `fuel_issue_product_date_idx` ON `fuelIssues` (`productId`,`issuedAt`);--> statement-breakpoint
CREATE INDEX `fuel_receipt_product_date_idx` ON `fuelReceipts` (`productId`,`receivedAt`);--> statement-breakpoint
CREATE INDEX `fuel_receipt_supplier_idx` ON `fuelReceipts` (`supplierId`);--> statement-breakpoint
CREATE INDEX `fuel_waste_product_date_idx` ON `fuelWasteRecords` (`productId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `section_role_user_idx` ON `sectionRoleGrants` (`userId`,`section`);