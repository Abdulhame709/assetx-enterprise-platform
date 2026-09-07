CREATE TABLE `alertAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertKey` varchar(191) NOT NULL,
	`siteId` int,
	`assignedToUserId` int NOT NULL,
	`assignedByUserId` int NOT NULL,
	`dueAt` timestamp NOT NULL,
	`note` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alertAssignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `alert_assignment_key_unique` UNIQUE(`alertKey`)
);
--> statement-breakpoint
ALTER TABLE `alertActionHistory` MODIFY COLUMN `action` enum('acknowledged','resolved','reopened','assigned') NOT NULL;--> statement-breakpoint
CREATE INDEX `alert_assignment_assignee_due_idx` ON `alertAssignments` (`assignedToUserId`,`dueAt`);--> statement-breakpoint
CREATE INDEX `alert_assignment_site_due_idx` ON `alertAssignments` (`siteId`,`dueAt`);