CREATE TABLE "body_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"weight" real,
	"body_fat" real,
	"waist" real,
	"chest" real,
	"arms" real,
	"thighs" real,
	"hips" real,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text,
	"name" text NOT NULL,
	"name_desi" text,
	"category" text NOT NULL,
	"muscle_group" text,
	"equipment" text,
	"difficulty" text,
	"type" text,
	"tracking" text DEFAULT 'weight_reps' NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"variation_of" text,
	"video_url" text,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"priority" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"target_date" timestamp with time zone,
	"phase_name" text,
	"objective" jsonb,
	"constraints" jsonb,
	"target_weight" real,
	"event_date" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"meal" text NOT NULL,
	"food_key" text,
	"quantity" real,
	"calories" integer,
	"protein" real,
	"carbs" real,
	"fat" real,
	"water_ml" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "personal_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"type" text NOT NULL,
	"value" real NOT NULL,
	"unit" text,
	"reps" integer,
	"weight" real,
	"session_id" text,
	"date" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"routine_id" text NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"block_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"order" integer NOT NULL,
	"sets" integer,
	"reps" integer,
	"weight" real,
	"duration_sec" integer,
	"distance_m" real,
	"rest_sec" integer,
	"rpe" integer,
	"tempo" text,
	"notes" text,
	"timer_type" text,
	"timer_config" jsonb
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"focus" text,
	"notes" text,
	"est_duration" integer,
	"days" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sleep_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"hours" real NOT NULL,
	"bedtime" text,
	"wake_time" text,
	"quality" integer
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"goal_id" text,
	"key" text,
	"type" text NOT NULL,
	"priority" text NOT NULL,
	"message" text NOT NULL,
	"action" jsonb,
	"accepted" boolean DEFAULT false NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timer_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"work_sec" integer,
	"rest_sec" integer,
	"rounds" integer,
	"total_sec" integer
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"language_mode" text DEFAULT 'desi' NOT NULL,
	"tone" text DEFAULT 'bhai' NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"units" text DEFAULT 'metric' NOT NULL,
	"food_db" text DEFAULT 'indian' NOT NULL,
	"region" text,
	"festival_mode" text,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"calorie_target" integer,
	"protein_target" integer,
	"water_target_ml" integer,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"routine_id" text,
	"name" text,
	"type" text,
	"date" timestamp with time zone NOT NULL,
	"duration" integer,
	"notes" text,
	"session_rpe" integer,
	"readiness" jsonb,
	"warmup_done" boolean DEFAULT false NOT NULL,
	"cooldown_done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"set_number" integer NOT NULL,
	"reps" integer,
	"weight" real,
	"duration_sec" integer,
	"distance_m" real,
	"rpe" integer,
	"rest_sec" integer,
	"is_warmup" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "body_metrics" ADD CONSTRAINT "body_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_logs" ADD CONSTRAINT "nutrition_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_records" ADD CONSTRAINT "personal_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_blocks" ADD CONSTRAINT "routine_blocks_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_block_id_routine_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."routine_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleep_logs" ADD CONSTRAINT "sleep_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer_presets" ADD CONSTRAINT "timer_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercises_user_idx" ON "exercises" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_slug_idx" ON "exercises" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "prs_user_ex_idx" ON "personal_records" USING btree ("user_id","exercise_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sessions_user_date_idx" ON "workout_sessions" USING btree ("user_id","date");