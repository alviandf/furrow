CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"plot_id" uuid NOT NULL,
	"type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"details" jsonb NOT NULL,
	"note" text,
	"photo_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crops" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kc_ini" double precision NOT NULL,
	"kc_mid" double precision NOT NULL,
	"kc_end" double precision NOT NULL,
	"p_table" double precision NOT NULL,
	"root_depth_m" double precision NOT NULL,
	"stage_days" jsonb
);
--> statement-breakpoint
CREATE TABLE "farms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"timezone" text NOT NULL,
	"irrigation_window_start" text DEFAULT '21:00' NOT NULL,
	"irrigation_window_end" text DEFAULT '05:00' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plot_sim_state" (
	"plot_id" uuid PRIMARY KEY NOT NULL,
	"theta" double precision NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"paused_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"crop_id" text NOT NULL,
	"soil_id" text NOT NULL,
	"planted_on" date,
	"area_m2" double precision NOT NULL,
	"root_depth_m" double precision,
	"irrigation_method" text NOT NULL,
	"efficiency" double precision NOT NULL,
	"flow_rate_lph" double precision NOT NULL,
	"drainage_per_hour" double precision,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensor_readings" (
	"plot_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"vwc" double precision NOT NULL,
	CONSTRAINT "sensor_readings_plot_id_recorded_at_pk" PRIMARY KEY("plot_id","recorded_at")
);
--> statement-breakpoint
CREATE TABLE "soils" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"field_capacity" double precision NOT NULL,
	"wilting_point" double precision NOT NULL,
	"drainage_per_hour" double precision DEFAULT 0.1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_snapshots" (
	"farm_id" uuid NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "weather_snapshots_farm_id_fetched_at_pk" PRIMARY KEY("farm_id","fetched_at")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_plot_id_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."plots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plot_sim_state" ADD CONSTRAINT "plot_sim_state_plot_id_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."plots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plots" ADD CONSTRAINT "plots_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plots" ADD CONSTRAINT "plots_crop_id_crops_id_fk" FOREIGN KEY ("crop_id") REFERENCES "public"."crops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plots" ADD CONSTRAINT "plots_soil_id_soils_id_fk" FOREIGN KEY ("soil_id") REFERENCES "public"."soils"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_plot_id_plots_id_fk" FOREIGN KEY ("plot_id") REFERENCES "public"."plots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_snapshots" ADD CONSTRAINT "weather_snapshots_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_plot_time_idx" ON "activities" USING btree ("plot_id","occurred_at" DESC NULLS LAST);