ALTER TABLE "tasks" ADD COLUMN "recurrence" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence_source_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_source_id_tasks_id_fk" FOREIGN KEY ("recurrence_source_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;