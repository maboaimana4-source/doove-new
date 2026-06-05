import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "$lib/db";
import { organization } from "$lib/db/schema/organization";
import { doove } from "$lib/db/schema/dooves";
import { QUOTA, workspaceUsage } from "$lib/db/schema/usage";
import { deleteObject } from "$lib/storage";

/**
 * Expiry sweep — runs from a cron. Two passes per call:
 *
 *   1. **Archive sweep** — finds published cloud dooves on Free
 *      workspaces with no views in `QUOTA.free.expireAfterNoViewsDays`
 *      days. Deletes the R2 blob, flips `status='archived'`, stamps
 *      `archivedAt`, decrements active / increments archived counters
 *      in `workspace_usage`, and reclaims `storage_bytes`.
 *
 *   2. **Hard-delete sweep** — finds rows in `archived` state older
 *      than `QUOTA.free.hardDeleteAfterArchiveDays` days. Drops the
 *      row entirely; share rows cascade-delete via FK.
 *
 * Pro and Enterprise workspaces are never touched — their QUOTA entries
 * have `expireAfterNoViewsDays: null`.
 *
 * The function is **idempotent on partial failure**: a row whose R2
 * delete throws is left untouched (we don't mark it archived until the
 * blob is actually gone), so a retry picks it up.
 */
export async function runExpirySweep(): Promise<{
	archived: number;
	hardDeleted: number;
	r2Failures: number;
}> {
	const archived = await archiveStaleFreeDooves();
	const hardDeleted = await hardDeleteArchivedFreeDooves();
	return {
		archived: archived.count,
		hardDeleted: hardDeleted.count,
		r2Failures: archived.r2Failures + hardDeleted.r2Failures,
	};
}

async function archiveStaleFreeDooves(): Promise<{
	count: number;
	r2Failures: number;
}> {
	const days = QUOTA.free.expireAfterNoViewsDays;
	if (days == null) return { count: 0, r2Failures: 0 };

	const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
	const db = getDb();

	// SELECT only Free-plan workspaces. Pro / Enterprise rows fall
	// through this filter, matching their `expireAfterNoViewsDays: null`.
	const candidates = await db
		.select({
			id: doove.id,
			workspaceId: doove.workspaceId,
			videoUrl: doove.videoUrl,
			sizeBytes: doove.sizeBytes,
		})
		.from(doove)
		.innerJoin(organization, eq(doove.workspaceId, organization.id))
		.where(
			and(
				eq(doove.status, "published"),
				eq(doove.source, "cloud"),
				eq(organization.plan, "free"),
				or(
					and(isNull(doove.lastViewedAt), lt(doove.createdAt, cutoff)),
					lt(doove.lastViewedAt, cutoff),
				),
			),
		);

	let r2Failures = 0;
	let count = 0;

	for (const row of candidates) {
		try {
			await deleteObject(row.videoUrl);
		} catch (err) {
			r2Failures++;
			console.error(`[expire] R2 delete failed for ${row.id}`, err);
			continue;
		}

		await db.transaction(async (tx) => {
			await tx
				.update(doove)
				.set({
					status: "archived",
					archivedAt: new Date(),
					sizeBytes: 0,
					updatedAt: new Date(),
				})
				.where(eq(doove.id, row.id));

			await tx
				.update(workspaceUsage)
				.set({
					storageBytes: sql`GREATEST(${workspaceUsage.storageBytes} - ${row.sizeBytes}, 0)`,
					activeDoovesCount: sql`GREATEST(${workspaceUsage.activeDoovesCount} - 1, 0)`,
					archivedDoovesCount: sql`${workspaceUsage.archivedDoovesCount} + 1`,
					updatedAt: new Date(),
				})
				.where(eq(workspaceUsage.workspaceId, row.workspaceId));
		});

		count++;
	}

	return { count, r2Failures };
}

async function hardDeleteArchivedFreeDooves(): Promise<{
	count: number;
	r2Failures: number;
}> {
	const days = QUOTA.free.hardDeleteAfterArchiveDays;
	if (days == null) return { count: 0, r2Failures: 0 };

	const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
	const db = getDb();

	const candidates = await db
		.select({
			id: doove.id,
			workspaceId: doove.workspaceId,
			videoUrl: doove.videoUrl,
		})
		.from(doove)
		.innerJoin(organization, eq(doove.workspaceId, organization.id))
		.where(
			and(
				eq(doove.status, "archived"),
				eq(organization.plan, "free"),
				lt(doove.archivedAt, cutoff),
			),
		);

	let r2Failures = 0;
	let count = 0;

	for (const row of candidates) {
		// Best-effort R2 delete — the blob is already nominally gone after
		// the archive step, but a half-successful archive could have left
		// it around. Treat 404 as success.
		try {
			await deleteObject(row.videoUrl);
		} catch (err) {
			r2Failures++;
			console.error(`[expire] R2 hard-delete failed for ${row.id}`, err);
			// Continue with row delete anyway — orphan blobs are reclaimed
			// by a future R2 lifecycle rule rather than blocking the DB
			// cleanup forever.
		}

		await db.transaction(async (tx) => {
			await tx.delete(doove).where(eq(doove.id, row.id));
			await tx
				.update(workspaceUsage)
				.set({
					archivedDoovesCount: sql`GREATEST(${workspaceUsage.archivedDoovesCount} - 1, 0)`,
					updatedAt: new Date(),
				})
				.where(eq(workspaceUsage.workspaceId, row.workspaceId));
		});

		count++;
	}

	return { count, r2Failures };
}
