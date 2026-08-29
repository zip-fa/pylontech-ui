CREATE TABLE "pack_health" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" bigint NOT NULL,
	"address" integer NOT NULL,
	"soh" double precision,
	"cycles" integer,
	"discharge_capacity_ah" double precision,
	"remain_capacity_ah" double precision,
	"resistance_milli_ohm" double precision,
	"round_trip_efficiency" double precision,
	"charge_throughput_wh" double precision,
	"discharge_throughput_wh" double precision,
	"trips" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_sample" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" bigint NOT NULL,
	"address" integer NOT NULL,
	"samples" integer NOT NULL,
	"voltage" double precision NOT NULL,
	"current" double precision NOT NULL,
	"power" double precision NOT NULL,
	"soc" double precision NOT NULL,
	"temperature" double precision NOT NULL,
	"temp_min" double precision NOT NULL,
	"temp_max" double precision NOT NULL,
	"mos_temperature" double precision,
	"cell_low" double precision NOT NULL,
	"cell_high" double precision NOT NULL,
	"spread" double precision,
	"base_state" varchar(32) NOT NULL,
	"alarm" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stack_sample" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" bigint NOT NULL,
	"samples" integer NOT NULL,
	"voltage" double precision NOT NULL,
	"current" double precision NOT NULL,
	"power" double precision NOT NULL,
	"power_min" double precision NOT NULL,
	"power_max" double precision NOT NULL,
	"soc" double precision NOT NULL,
	"energy_remaining" double precision,
	"temp_min" double precision NOT NULL,
	"temp_max" double precision NOT NULL,
	"spread" double precision NOT NULL,
	"charged_wh" double precision DEFAULT 0 NOT NULL,
	"discharged_wh" double precision DEFAULT 0 NOT NULL,
	"present_count" integer NOT NULL,
	"pack_count" integer NOT NULL,
	"alarm" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pack_health_address_at" ON "pack_health" USING btree ("address","at");--> statement-breakpoint
CREATE UNIQUE INDEX "pack_sample_at_address" ON "pack_sample" USING btree ("at","address");--> statement-breakpoint
CREATE UNIQUE INDEX "stack_sample_at" ON "stack_sample" USING btree ("at");