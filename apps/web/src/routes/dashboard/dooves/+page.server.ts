import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { getDb } from "$lib/db";
import { folder, doove, tag } from "$lib/db/schema";
import { QUOTA } from "$lib/db/schema/usage";
import {
	dooveLatestShareSlugSql,
	dooveTagIdsSql,
	dooveViewsSql,
} from "$lib/db/doove-selectors";
import { resolvePlaybackUrl } from "$lib/storage";
import type { PageServerLoad } from "./$types";

// Archived rows only ever belong to Free workspaces (Pro/Enterprise never
// auto-archive), so the Free hard-delete window is the correct countdown for
// every archived doove we surface.
const HARD_DELETE_DAYS = QUOTA.free.hardDeleteAfterArchiveDays ?? 16;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Full library loader. Larger limit than the home page.
 *
 * Returns the active doove list (each with its `folderId` + `tags` id
 * array), plus the workspace's folder tree and tag set, so the library can
 * render organization without extra client round-trips on first paint.
 *
 * Also returns the workspace's `archived` dooves — blobless rows the expiry
 * job parked after 14 days with no views. These power the "Archived" tab,
 * which lets the owner delete them outright or re-upload from desktop before
 * the hard-delete sweep purges them at `archivedAt + 16d`.
 */
export const load: PageServerLoad = async ({ parent }) => {
	const { activeOrganization } = await parent();
	const db = getDb();
	const workspaceId = activeOrganization.id;

	const [rows, archivedRows, folders, tags] = await Promise.all([
		db
			.select({
				id: doove.id,
				title: doove.title,
				durationSec: doove.durationSec,
				sizeBytes: doove.sizeBytes,
				source: doove.source,
				provider: doove.provider,
				status: doove.status,
				folderId: doove.folderId,
				videoUrl: doove.videoUrl,
				posterUrl: doove.posterUrl,
				createdAt: doove.createdAt,
				views: dooveViewsSql(),
				latestShareSlug: dooveLatestShareSlugSql(),
				// Tag id array per doove — resolved against the `tags` list
				// below in the UI. `[]` when untagged.
				tags: dooveTagIdsSql(),
			})
			.from(doove)
			.where(and(eq(doove.workspaceId, workspaceId), ne(doove.status, "archived")))
			.orderBy(desc(doove.createdAt))
			.limit(200),
		db
			.select({
				id: doove.id,
				title: doove.title,
				durationSec: doove.durationSec,
				sizeBytes: doove.sizeBytes,
				posterUrl: doove.posterUrl,
				archivedAt: doove.archivedAt,
				createdAt: doove.createdAt,
			})
			.from(doove)
			.where(
				and(
					eq(doove.workspaceId, workspaceId),
					eq(doove.status, "archived"),
					// Rows the hard-delete sweep has tombstoned are effectively gone.
					isNull(doove.deletedAt),
				),
			)
			.orderBy(desc(doove.archivedAt))
			.limit(100),
		db
			.select({
				id: folder.id,
				parentId: folder.parentId,
				name: folder.name,
				color: folder.color,
				path: folder.path,
			})
			.from(folder)
			.where(eq(folder.workspaceId, workspaceId)),
		db
			.select({ id: tag.id, name: tag.name, color: tag.color })
			.from(tag)
			.where(eq(tag.workspaceId, workspaceId)),
	]);

	return {
		workspaceId,
		// `videoUrl` is stored as a bare object key; sign it into a playable URL
		// the same way the share page does (signing is local/cheap per row).
		dooves: await Promise.all(
			rows.map(async (r) => ({
				...r,
				videoUrl: await resolvePlaybackUrl(r.videoUrl),
				posterUrl: await resolvePlaybackUrl(r.posterUrl),
				sizeBytes: Number(r.sizeBytes),
				views: Number(r.views ?? 0),
				createdAt: r.createdAt.getTime(),
				tags: r.tags ?? [],
			})),
		),
		archived: archivedRows.map((r) => {
			const archivedMs = (r.archivedAt ?? r.createdAt).getTime();
			return {
				id: r.id,
				title: r.title,
				durationSec: r.durationSec,
				sizeBytes: Number(r.sizeBytes),
				posterUrl: r.posterUrl,
				archivedAt: archivedMs,
				// When the hard-delete sweep will purge the row + poster for good.
				deletesAt: archivedMs + HARD_DELETE_DAYS * DAY_MS,
			};
		}),
		folders,
		tags,
	};
};
