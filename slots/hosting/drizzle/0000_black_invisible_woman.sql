CREATE TABLE `studio_handoffs` (
	`id` text NOT NULL,
	`owner` text NOT NULL,
	`source_run` text NOT NULL,
	`target` text NOT NULL,
	`summary` text NOT NULL,
	`next_task` text NOT NULL,
	`status` text NOT NULL,
	`hops` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`id`, `owner`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `handoff_source` ON `studio_handoffs` (`owner`,`source_run`);--> statement-breakpoint
CREATE TABLE `studio_locks` (
	`project_key` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`run_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `studio_runs` (
	`id` text NOT NULL,
	`owner` text NOT NULL,
	`project_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` text NOT NULL,
	`hops` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`session_id` text,
	`result_key` text,
	`error` text,
	PRIMARY KEY(`id`, `owner`)
);
