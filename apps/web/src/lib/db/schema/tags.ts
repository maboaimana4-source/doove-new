import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { organization } from "./organization";
import { doove } from "./dooves";

/**
 * Workspace-scoped free-text label. Used for multi-select filter chips on
 * the library view. Tag names are case-insensitive on read but stored as
 * entered; the unique constraint is exact-match by design — let the UI
 * dedupe on lowercase before insert.
 */
export const tag = pgTable(
	"tag",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		/** Hex color or null for default. */
		color: text("color"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [
		index("tag_workspace_idx").on(t.workspaceId),
		unique("tag_workspace_name_key").on(t.workspaceId, t.name),
	],
);

export const dooveTag = pgTable(
	"doove_tag",
	{
		dooveId: text("doove_id")
			.notNull()
			.references(() => doove.id, { onDelete: "cascade" }),
		tagId: text("tag_id")
			.notNull()
			.references(() => tag.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [
		index("doove_tag_tag_idx").on(t.tagId),
		unique("doove_tag_doove_tag_key").on(t.dooveId, t.tagId),
	],
);

export type Tag = typeof tag.$inferSelect;
export type DooveTag = typeof dooveTag.$inferSelect;
