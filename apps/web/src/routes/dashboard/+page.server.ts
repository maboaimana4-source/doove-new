import { desc, eq } from "drizzle-orm";
import { getDb } from "$lib/db";
import { doove } from "$lib/db/schema";
import { loadWorkspaceActivity } from "$lib/dashboard/activity.server";
import { dooveLatestShareSlugSql, dooveViewsSql } from "$lib/db/doove-selectors";
import { resolvePlaybackUrl } from "$lib/storage";
import type { PageServerLoad } from "./$types";

/**
 * Dashboard home loader. The layout above has already resolved the
 * active workspace and quota — here we just fetch the most recent
 * non-archived dooves for the metrics cards, activity feed, and
 * "Top dooves" rail.
 *
 * Trimmed to 12 — enough to fill all three rails on the home page;
 * the full library lives at /dashboard/dooves.
 */
export const load: PageServerLoad = async ({ parent }) => {
	const { activeOrganization } = await parent();
	const db = getDb();

	const [dooves, activity] = await Promise.all([
		db
		.select({
			id: doove.id,
			title: doove.title,
			durationSec: doove.durationSec,
			sizeBytes: doove.sizeBytes,
			source: doove.source,
			provider: doove.provider,
			status: doove.status,
			videoUrl: doove.videoUrl,
			posterUrl: doove.posterUrl,
			createdAt: doove.createdAt,
			views: dooveViewsSql(),
			latestShareSlug: dooveLatestShareSlugSql(),
		})
			.from(doove)
			.where(eq(doove.workspaceId, activeOrganization.id))
			.orderBy(desc(doove.createdAt))
			.limit(12),
		loadWorkspaceActivity(activeOrganization.id),
	]);

	return {
		// Surfaced so the home page can upload into the active workspace
		// (mirrors what the library loader returns).
		workspaceId: activeOrganization.id,
		// `videoUrl` is a bare object key — sign it into a playable URL (mirrors
		// the share page; signing is local, and the list is capped at 12 here).
		dooves: await Promise.all(
			dooves
				.filter((r) => r.status !== "archived")
				.map(async (r) => ({
					...r,
					videoUrl: await resolvePlaybackUrl(r.videoUrl),
					posterUrl: await resolvePlaybackUrl(r.posterUrl),
					sizeBytes: Number(r.sizeBytes),
					views: Number(r.views ?? 0),
					createdAt: r.createdAt.getTime(),
				})),
		),
		activity,
	};
};

