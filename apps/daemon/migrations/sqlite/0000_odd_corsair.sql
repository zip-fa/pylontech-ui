CREATE TABLE `pack_health` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`address` integer NOT NULL,
	`soh` real,
	`cycles` integer,
	`discharge_capacity_ah` real,
	`remain_capacity_ah` real,
	`resistance_milli_ohm` real,
	`round_trip_efficiency` real,
	`charge_throughput_wh` real,
	`discharge_throughput_wh` real,
	`trips` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pack_health_address_at` ON `pack_health` (`address`,`at`);--> statement-breakpoint
CREATE TABLE `pack_sample` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`address` integer NOT NULL,
	`samples` integer NOT NULL,
	`voltage` real NOT NULL,
	`current` real NOT NULL,
	`power` real NOT NULL,
	`soc` real NOT NULL,
	`temperature` real NOT NULL,
	`temp_min` real NOT NULL,
	`temp_max` real NOT NULL,
	`mos_temperature` real,
	`cell_low` real NOT NULL,
	`cell_high` real NOT NULL,
	`spread` real,
	`base_state` text NOT NULL,
	`alarm` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pack_sample_at_address` ON `pack_sample` (`at`,`address`);--> statement-breakpoint
CREATE TABLE `stack_sample` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`samples` integer NOT NULL,
	`voltage` real NOT NULL,
	`current` real NOT NULL,
	`power` real NOT NULL,
	`power_min` real NOT NULL,
	`power_max` real NOT NULL,
	`soc` real NOT NULL,
	`energy_remaining` real,
	`temp_min` real NOT NULL,
	`temp_max` real NOT NULL,
	`spread` real NOT NULL,
	`charged_wh` real DEFAULT 0 NOT NULL,
	`discharged_wh` real DEFAULT 0 NOT NULL,
	`present_count` integer NOT NULL,
	`pack_count` integer NOT NULL,
	`alarm` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stack_sample_at` ON `stack_sample` (`at`);