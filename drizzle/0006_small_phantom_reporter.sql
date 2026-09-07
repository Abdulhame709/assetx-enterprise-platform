CREATE TABLE `userPermissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`section` enum('energy','fuel') NOT NULL,
	`resource` varchar(96) NOT NULL,
	`action` enum('view','create','update','delete','approve','print','export') NOT NULL,
	`effect` enum('allow','deny') NOT NULL DEFAULT 'allow',
	`grantedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userPermissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_permission_unique` UNIQUE(`userId`,`section`,`resource`,`action`)
);
--> statement-breakpoint
CREATE INDEX `user_permission_user_idx` ON `userPermissions` (`userId`,`section`);--> statement-breakpoint
CREATE INDEX `user_permission_resource_idx` ON `userPermissions` (`section`,`resource`,`action`);