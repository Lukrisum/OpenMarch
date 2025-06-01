PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_history_undo` (
	`sequence` integer PRIMARY KEY NOT NULL,
	`history_group` integer NOT NULL,
	`sql` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_history_undo`("sequence", "history_group", "sql") SELECT "sequence", "history_group", "sql" FROM `history_undo`;--> statement-breakpoint
DROP TABLE `history_undo`;--> statement-breakpoint
ALTER TABLE `__new_history_undo` RENAME TO `history_undo`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_history_redo` (
	`sequence` integer PRIMARY KEY NOT NULL,
	`history_group` integer NOT NULL,
	`sql` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_history_redo`("sequence", "history_group", "sql") SELECT "sequence", "history_group", "sql" FROM `history_redo`;--> statement-breakpoint
DROP TABLE `history_redo`;--> statement-breakpoint
ALTER TABLE `__new_history_redo` RENAME TO `history_redo`;--> statement-breakpoint
CREATE TABLE `__new_history_stats` (
	`id` integer PRIMARY KEY NOT NULL,
	`cur_undo_group` integer NOT NULL,
	`cur_redo_group` integer NOT NULL,
	`group_limit` integer NOT NULL,
	CONSTRAINT "history_stats_check_1" CHECK(id = 1)
);
--> statement-breakpoint
INSERT INTO `__new_history_stats`("id", "cur_undo_group", "cur_redo_group", "group_limit") SELECT "id", "cur_undo_group", "cur_redo_group", "group_limit" FROM `history_stats`;--> statement-breakpoint
DROP TABLE `history_stats`;--> statement-breakpoint
ALTER TABLE `__new_history_stats` RENAME TO `history_stats`;--> statement-breakpoint
CREATE TABLE `__new_beats` (
	`id` integer PRIMARY KEY NOT NULL,
	`duration` real NOT NULL,
	`position` integer NOT NULL,
	`include_in_measure` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	`updated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	CONSTRAINT "beats_check_2" CHECK(duration >= 0),
	CONSTRAINT "beats_check_3" CHECK(position >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_beats`("id", "duration", "position", "include_in_measure", "notes", "created_at", "updated_at") SELECT "id", "duration", "position", "include_in_measure", "notes", "created_at", "updated_at" FROM `beats`;--> statement-breakpoint
DROP TABLE `beats`;--> statement-breakpoint
ALTER TABLE `__new_beats` RENAME TO `beats`;--> statement-breakpoint
CREATE TABLE `__new_measures` (
	`id` integer PRIMARY KEY NOT NULL,
	`start_beat` integer NOT NULL,
	`rehearsal_mark` text,
	`notes` text,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	`updated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	FOREIGN KEY (`start_beat`) REFERENCES `beats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_measures`("id", "start_beat", "rehearsal_mark", "notes", "created_at", "updated_at") SELECT "id", "start_beat", "rehearsal_mark", "notes", "created_at", "updated_at" FROM `measures`;--> statement-breakpoint
DROP TABLE `measures`;--> statement-breakpoint
ALTER TABLE `__new_measures` RENAME TO `measures`;--> statement-breakpoint
CREATE TABLE `__new_pages` (
	`id` integer PRIMARY KEY NOT NULL,
	`is_subset` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	`updated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	`start_beat` integer NOT NULL,
	FOREIGN KEY (`start_beat`) REFERENCES `beats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_pages`("id", "is_subset", "notes", "created_at", "updated_at", "start_beat") SELECT "id", "is_subset", "notes", "created_at", "updated_at", "start_beat" FROM `pages`;--> statement-breakpoint
DROP TABLE `pages`;--> statement-breakpoint
ALTER TABLE `__new_pages` RENAME TO `pages`;--> statement-breakpoint
CREATE TABLE `__new_marchers` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`section` text NOT NULL,
	`year` text,
	`notes` text,
	`drill_prefix` text NOT NULL,
	`drill_order` integer NOT NULL,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`updated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`'
);
--> statement-breakpoint
INSERT INTO `__new_marchers`("id", "name", "section", "year", "notes", "drill_prefix", "drill_order", "created_at", "updated_at") SELECT "id", "name", "section", "year", "notes", "drill_prefix", "drill_order", "created_at", "updated_at" FROM `marchers`;--> statement-breakpoint
DROP TABLE `marchers`;--> statement-breakpoint
ALTER TABLE `__new_marchers` RENAME TO `marchers`;--> statement-breakpoint
CREATE TABLE `__new_marcher_pages` (
	`id` integer PRIMARY KEY NOT NULL,
	`id_for_html` text,
	`marcher_id` integer NOT NULL,
	`page_id` integer NOT NULL,
	`x` real,
	`y` real,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`updated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`notes` text,
	FOREIGN KEY (`marcher_id`) REFERENCES `marchers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_marcher_pages`("id", "id_for_html", "marcher_id", "page_id", "x", "y", "created_at", "updated_at", "notes") SELECT "id", "id_for_html", "marcher_id", "page_id", "x", "y", "created_at", "updated_at", "notes" FROM `marcher_pages`;--> statement-breakpoint
DROP TABLE `marcher_pages`;--> statement-breakpoint
ALTER TABLE `__new_marcher_pages` RENAME TO `marcher_pages`;--> statement-breakpoint
CREATE INDEX `index_marcher_pages_on_page_id` ON `marcher_pages` (`page_id`);--> statement-breakpoint
CREATE INDEX `index_marcher_pages_on_marcher_id` ON `marcher_pages` (`marcher_id`);--> statement-breakpoint
CREATE TABLE `__new_field_properties` (
	`id` integer PRIMARY KEY NOT NULL,
	`json_data` text NOT NULL,
	`image` blob,
	CONSTRAINT "field_properties_check_6" CHECK(id = 1)
);
--> statement-breakpoint
INSERT INTO `__new_field_properties`("id", "json_data", "image") SELECT "id", "json_data", "image" FROM `field_properties`;--> statement-breakpoint
DROP TABLE `field_properties`;--> statement-breakpoint
ALTER TABLE `__new_field_properties` RENAME TO `field_properties`;--> statement-breakpoint
CREATE TABLE `__new_audio_files` (
	`id` integer PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`nickname` text,
	`data` blob,
	`selected` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`updated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`'
);
--> statement-breakpoint
INSERT INTO `__new_audio_files`("id", "path", "nickname", "data", "selected", "created_at", "updated_at") SELECT "id", "path", "nickname", "data", "selected", "created_at", "updated_at" FROM `audio_files`;--> statement-breakpoint
DROP TABLE `audio_files`;--> statement-breakpoint
ALTER TABLE `__new_audio_files` RENAME TO `audio_files`;--> statement-breakpoint
CREATE TABLE `__new_shapes` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	`updated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	`notes` text
);
--> statement-breakpoint
INSERT INTO `__new_shapes`("id", "name", "created_at", "updated_at", "notes") SELECT "id", "name", "created_at", "updated_at", "notes" FROM `shapes`;--> statement-breakpoint
DROP TABLE `shapes`;--> statement-breakpoint
ALTER TABLE `__new_shapes` RENAME TO `shapes`;--> statement-breakpoint
CREATE TABLE `__new_shape_pages` (
	`id` integer PRIMARY KEY NOT NULL,
	`shape_id` integer NOT NULL,
	`page_id` integer NOT NULL,
	`svg_path` text NOT NULL,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	`updated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	`notes` text,
	FOREIGN KEY (`shape_id`) REFERENCES `shapes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_shape_pages`("id", "shape_id", "page_id", "svg_path", "created_at", "updated_at", "notes") SELECT "id", "shape_id", "page_id", "svg_path", "created_at", "updated_at", "notes" FROM `shape_pages`;--> statement-breakpoint
DROP TABLE `shape_pages`;--> statement-breakpoint
ALTER TABLE `__new_shape_pages` RENAME TO `shape_pages`;--> statement-breakpoint
CREATE TABLE `__new_shape_page_marchers` (
	`id` integer PRIMARY KEY NOT NULL,
	`shape_page_id` integer NOT NULL,
	`marcher_id` integer NOT NULL,
	`position_order` integer,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	`updated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	`notes` text,
	FOREIGN KEY (`shape_page_id`) REFERENCES `shape_pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`marcher_id`) REFERENCES `marchers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_shape_page_marchers`("id", "shape_page_id", "marcher_id", "position_order", "created_at", "updated_at", "notes") SELECT "id", "shape_page_id", "marcher_id", "position_order", "created_at", "updated_at", "notes" FROM `shape_page_marchers`;--> statement-breakpoint
DROP TABLE `shape_page_marchers`;--> statement-breakpoint
ALTER TABLE `__new_shape_page_marchers` RENAME TO `shape_page_marchers`;--> statement-breakpoint
CREATE INDEX `idx-spm-marcher_id` ON `shape_page_marchers` (`marcher_id`);--> statement-breakpoint
CREATE INDEX `idx-spm-shape_page_id` ON `shape_page_marchers` (`shape_page_id`);--> statement-breakpoint
CREATE TABLE `__new_section_appearances` (
	`id` integer PRIMARY KEY NOT NULL,
	`section` text NOT NULL,
	`fill_color` text DEFAULT 'rgba(0, 0, 0, 1)' NOT NULL,
	`outline_color` text DEFAULT 'rgba(0, 0, 0, 1)' NOT NULL,
	`shape_type` text DEFAULT 'circle' NOT NULL,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	`updated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_section_appearances`("id", "section", "fill_color", "outline_color", "shape_type", "created_at", "updated_at") SELECT "id", "section", "fill_color", "outline_color", "shape_type", "created_at", "updated_at" FROM `section_appearances`;--> statement-breakpoint
DROP TABLE `section_appearances`;--> statement-breakpoint
ALTER TABLE `__new_section_appearances` RENAME TO `section_appearances`;--> statement-breakpoint
CREATE TABLE `__new_utility` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_page_counts` integer,
	CONSTRAINT "utility_check_7" CHECK(id = 0),
	CONSTRAINT "utility_check_8" CHECK(last_page_counts >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_utility`("id", "last_page_counts") SELECT "id", "last_page_counts" FROM `utility`;--> statement-breakpoint
DROP TABLE `utility`;--> statement-breakpoint
ALTER TABLE `__new_utility` RENAME TO `utility`;