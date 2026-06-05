import { error } from "@sveltejs/kit";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "$lib/db";
import { doove, share } from "$lib/db/schema";
import { loadDooveActivity, loadDooveEngagement } from "$lib/dashboard/activity.server";
import { resolvePlaybackUrl } from "$lib/storage";
import type { PageServerLoad } from "./$types";

/**
 * Per-doove detail loader. Authorizes the doove against the active workspace
 * (404 otherwise), signs its playable + poster URLs, and pulls everything the
 * detail page renders: the doove's own activity (chart/retention/feed), its
 * engagement (comments/reactions), and its share links.
 */
export const load: PageServerLoad = async ({ params, parent }) => {
	const { activeOrganization } = await parent();
	const db = getDb();
	const workspaceId = activeOrganization.id;

	const [row] = await db
		.select({
			id: doove.id,
			title: doove.title,
			durationSec: doove.durationSec,
			sizeBytes: doove.sizeBytes,
			width: doove.width,
			height: doove.height,
			source: doove.source,
			provider: doove.provider,
			status: doove.status,
			videoUrl: doove.videoUrl,
			posterUrl: doove.posterUrl,
			createdAt: doove.createdAt,
		})
		.from(doove)
		.where(and(eq(doove.id, params.id), eq(doove.workspaceId, workspaceId)))
		.limit(1);
	if (!row) error(404, "Doove not found");

	const [shareRows, activity, engagement, videoUrl, posterUrl] = await Promise.all([
		db
			.select({
				slug: share.slug,
				visibility: share.visibility,
				passwordHash: share.passwordHash,
				expiresAt: share.expiresAt,
				viewsCount: share.viewsCount,
				createdAt: share.createdAt,
			})
			.from(share)
			.where(eq(share.dooveId, params.id))
			.orderBy(desc(share.createdAt)),
		loadDooveActivity(params.id),
		loadDooveEngagement(params.id),
		resolvePlaybackUrl(row.videoUrl),
		resolvePlaybackUrl(row.posterUrl),
	]);

	return {
		doove: {
			id: row.id,
			title: row.title,
			durationSec: row.durationSec,
			sizeBytes: Number(row.sizeBytes),
			width: row.width,
			height: row.height,
			source: row.source,
			provider: row.provider,
			status: row.status,
			videoUrl,
			posterUrl,
			createdAt: row.createdAt.getTime(),
		},
		shares: shareRows.map((s) => ({
			slug: s.slug,
			visibility: s.visibility,
			viewsCount: s.viewsCount,
			hasPassword: Boolean(s.passwordHash),
			expiresAt: s.expiresAt ? s.expiresAt.getTime() : null,
			createdAt: (s.createdAt ?? new Date(0)).getTime(),
		})),
		activity,
		engagement,
	};
};
