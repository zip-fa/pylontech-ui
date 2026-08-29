CREATE TABLE `pack_health` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`at` bigint NOT NULL,
	`address` int NOT NULL,
	`soh` double,
	`cycles` int,
	`discharge_capacity_ah` double,
	`remain_capacity_ah` double,
	`resistance_milli_ohm` double,
	`round_trip_efficiency` double,
	`charge_throughput_wh` double,
	`discharge_throughput_wh` double,
	`trips` int NOT NULL DEFAULT 0,
	CONSTRAINT `pack_health_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pack_sample` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`at` bigint NOT NULL,
	`address` int NOT NULL,
	`samples` int NOT NULL,
	`voltage` double NOT NULL,
	`current` double NOT NULL,
	`power` double NOT NULL,
	`soc` double NOT NULL,
	`temperature` double NOT NULL,
	`temp_min` double NOT NULL,
	`temp_max` double NOT NULL,
	`mos_temperature` double,
	`cell_low` double NOT NULL,
	`cell_high` double NOT NULL,
	`spread` double,
	`base_state` varchar(32) NOT NULL,
	`alarm` boolean NOT NULL DEFAULT false,
	CONSTRAINT `pack_sample_id` PRIMARY KEY(`id`),
	CONSTRAINT `pack_sample_at_address` UNIQUE(`at`,`address`)
);
--> statement-breakpoint
CREATE TABLE `stack_sample` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`at` bigint NOT NULL,
	`samples` int NOT NULL,
	`voltage` double NOT NULL,
	`current` double NOT NULL,
	`power` double NOT NULL,
	`power_min` double NOT NULL,
	`power_max` double NOT NULL,
	`soc` double NOT NULL,
	`energy_remaining` double,
	`temp_min` double NOT NULL,
	`temp_max` double NOT NULL,
	`spread` double NOT NULL,
	`charged_wh` double NOT NULL DEFAULT 0,
	`discharged_wh` double NOT NULL DEFAULT 0,
	`present_count` int NOT NULL,
	`pack_count` int NOT NULL,
	`alarm` boolean NOT NULL DEFAULT false,
	CONSTRAINT `stack_sample_id` PRIMARY KEY(`id`),
	CONSTRAINT `stack_sample_at` UNIQUE(`at`)
);
--> statement-breakpoint
CREATE INDEX `pack_health_address_at` ON `pack_health` (`address`,`at`);