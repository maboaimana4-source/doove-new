/**
 * Real viewer-activity loader. Reads the `share_view` rows the player records
 * (via POST /api/share/[id]/view) and the workspace's shares, joins them up to
 * the owning doove, and projects both into the shared `Activity` shape the
 * Home + Analytics surfaces render. Replaces the old deterministic mock.
 */

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "$lib/db";
import { doove, share, shareComment, shareReaction, shareView } from "$lib/db/schema";
import { deviceFromUA } from "$lib/share/ua";
import type { Activity, EngagementMoment, DooveEngagement, DoovePerf } from "./activity";

let regionNames: Intl.DisplayNames | null = null;
function viewerLabel(country: string | null): string {
	if (!country) return "Anonymous viewer";
	try {
		regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
		const name = regionNames.of(country.toUpperCase());
		return name ? `Viewer from ${name}` : "Anonymous viewer";
	} catch {
		return "Anonymous viewer";
	}
}

type ViewRow = {
	id: string;
	dooveId: string;
	dooveTitle: string;
	sessionId: string;
	country: string | null;
	device: string | null;
	userAgent: string | null;
	referrer: string | null;
	completed: boolean;
	watchPct: number;
	createdAt: Date | null;
};

function viewRowToActivity(r: ViewRow): Activity {
	return {
		id: r.id,
		dooveId: r.dooveId,
		dooveTitle: r.dooveTitle,
		viewer: viewerLabel(r.country),
		sessionId: r.sessionId,
		country: r.country,
		// Prefer the stored device; back-fill from the UA for rows written before
		// the `device` column existed so historical breakdowns still populate.
		device: r.device ?? deviceFromUA(r.userAgent),
		referrer: r.referrer,
		kind: r.completed ? "completed" : "viewed",
		timestamp: (r.createdAt ?? new Date(0)).getTime(),
		watchPct: r.watchPct,
	};
}

/** Columns every view query needs to build an `Activity` (kept in sync so the
 *  workspace + per-doove loaders project identically). */
const viewSelection = {
	id: shareView.id,
	dooveId: doove.id,
	dooveTitle: doove.title,
	sessionId: shareView.sessionId,
	country: shareView.country,
	device: shareView.device,
	userAgent: shareView.userAgent,
	referrer: shareView.referrer,
	completed: shareView.completed,
	watchPct: shareView.watchPct,
	createdAt: shareView.createdAt,
} as const;

/**
 * Load the workspace's viewer activity — view/completion events plus
 * share-created events — newest first. `limit` caps each source independently;
 * the merged list is what the pages slice by date range.
 */
export async function loadWorkspaceActivity(
	workspaceId: string,
	limit = 250,
): Promise<Activity[]> {
	const db = getDb();

	const [viewRows, shareRows] = await Promise.all([
		db
			.select(viewSelection)
			.from(shareView)
			.innerJoin(share, eq(shareView.shareId, share.slug))
			.innerJoin(doove, eq(share.dooveId, doove.id))
			.where(eq(doove.workspaceId, workspaceId))
			.orderBy(desc(shareView.createdAt))
			.limit(limit),
		db
			.select({
				slug: share.slug,
				dooveId: doove.id,
				dooveTitle: doove.title,
				createdAt: share.createdAt,
			})
			.from(share)
			.innerJoin(doove, eq(share.dooveId, doove.id))
			.where(eq(doove.workspaceId, workspaceId))
			.orderBy(desc(share.createdAt))
			.limit(limit),
	]);

	const views: Activity[] = viewRows.map(viewRowToActivity);

	const shares: Activity[] = shareRows.map((r) => ({
		id: `${r.slug}-shared`,
		dooveId: r.dooveId,
		dooveTitle: r.dooveTitle,
		viewer: "You",
		kind: "shared",
		timestamp: (r.createdAt ?? new Date(0)).getTime(),
		watchPct: 0,
	}));

	return [...views, ...shares].sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Same projection as `loadWorkspaceActivity` but scoped to a single doove —
 * powers the per-doove detail page's chart, retention curve, and feed.
 */
export async function loadDooveActivity(
	dooveId: string,
	limit = 500,
): Promise<Activity[]> {
	const db = getDb();

	const [viewRows, shareRows] = await Promise.all([
		db
			.select(viewSelection)
			.from(shareView)
			.innerJoin(share, eq(shareView.shareId, share.slug))
			.innerJoin(doove, eq(share.dooveId, doove.id))
			.where(eq(doove.id, dooveId))
			.orderBy(desc(shareView.createdAt))
			.limit(limit),
		db
			.select({
				slug: share.slug,
				dooveId: doove.id,
				dooveTitle: doove.title,
				createdAt: share.createdAt,
			})
			.from(share)
			.innerJoin(doove, eq(share.dooveId, doove.id))
			.where(eq(doove.id, dooveId))
			.orderBy(desc(share.createdAt)),
	]);

	const views: Activity[] = viewRows.map(viewRowToActivity);
	const shares: Activity[] = shareRows.map((r) => ({
		id: `${r.slug}-shared`,
		dooveId: r.dooveId,
		dooveTitle: r.dooveTitle,
		viewer: "You",
		kind: "shared",
		timestamp: (r.createdAt ?? new Date(0)).getTime(),
		watchPct: 0,
	}));

	return [...views, ...shares].sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Comments + reactions for a doove (across all its shares). This data is
 * collected by the player but was never surfaced to owners — the detail page
 * is where it closes the feedback loop.
 */
export async function loadDooveEngagement(dooveId: string): Promise<DooveEngagement> {
	const db = getDb();

	const [commentRows, reactionRows] = await Promise.all([
		db
			.select({
				authorName: shareComment.authorName,
				body: shareComment.body,
				atSeconds: shareComment.atSeconds,
				createdAt: shareComment.createdAt,
			})
			.from(shareComment)
			.innerJoin(share, eq(shareComment.shareSlug, share.slug))
			.where(and(eq(share.dooveId, dooveId), isNull(shareComment.deletedAt)))
			.orderBy(desc(shareComment.createdAt)),
		db
			.select({ emoji: shareReaction.emoji, atSeconds: shareReaction.atSeconds })
			.from(shareReaction)
			.innerJoin(share, eq(shareReaction.shareSlug, share.slug))
			.where(eq(share.dooveId, dooveId)),
	]);

	const counts = new Map<string, number>();
	for (const r of reactionRows) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);

	// Every reaction + comment with its video timestamp — the heatmap input.
	const moments: EngagementMoment[] = [
		...reactionRows.map((r) => ({ atSeconds: r.atSeconds, kind: "reaction" as const, emoji: r.emoji })),
		...commentRows.map((c) => ({ atSeconds: c.atSeconds, kind: "comment" as const })),
	];

	return {
		commentCount: commentRows.length,
		reactionCount: reactionRows.length,
		reactions: [...counts.entries()]
			.map(([emoji, count]) => ({ emoji, count }))
			.sort((a, b) => b.count - a.count),
		recentComments: commentRows.slice(0, 20).map((c) => ({
			authorName: c.authorName,
			body: c.body,
			atSeconds: c.atSeconds,
			createdAt: (c.createdAt ?? new Date(0)).getTime(),
		})),
		moments,
	};
}

/**
 * Per-doove performance rollups for the workspace analytics comparison table:
 * play count, average watch %, completion %, and comment count, grouped in two
 * aggregate queries (no N+1). Returns a dooveId → metrics map.
 */
export async function loadWorkspacePerformance(
	workspaceId: string,
): Promise<Map<string, DoovePerf>> {
	const db = getDb();

	const [watch, comments] = await Promise.all([
		db
			.select({
				dooveId: doove.id,
				views: sql<number>`count(*)`,
				avgWatch: sql<number>`coalesce(avg(${shareView.watchPct}), 0)`,
				completion: sql<number>`coalesce(avg((${shareView.completed})::int) * 100, 0)`,
			})
			.from(shareView)
			.innerJoin(share, eq(shareView.shareId, share.slug))
			.innerJoin(doove, eq(share.dooveId, doove.id))
			.where(eq(doove.workspaceId, workspaceId))
			.groupBy(doove.id),
		db
			.select({ dooveId: doove.id, comments: sql<number>`count(*)` })
			.from(shareComment)
			.innerJoin(share, eq(shareComment.shareSlug, share.slug))
			.innerJoin(doove, eq(share.dooveId, doove.id))
			.where(and(eq(doove.workspaceId, workspaceId), isNull(shareComment.deletedAt)))
			.groupBy(doove.id),
	]);

	const map = new Map<string, DoovePerf>();
	for (const w of watch) {
		map.set(w.dooveId, {
			views: Number(w.views),
			avgWatch: Math.round(Number(w.avgWatch)),
			completion: Math.round(Number(w.completion)),
			comments: 0,
		});
	}
	for (const c of comments) {
		const e = map.get(c.dooveId) ?? { views: 0, avgWatch: 0, completion: 0, comments: 0 };
		e.comments = Number(c.comments);
		map.set(c.dooveId, e);
	}
	return map;
}
