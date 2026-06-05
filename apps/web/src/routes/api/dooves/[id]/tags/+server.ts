import { error, json } from "@sveltejs/kit";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "$lib/db";
import { doove, dooveTag, tag, user } from "$lib/db/schema";
import { requireUser } from "$lib/workspace/guard";
import type { RequestHandler } from "./$types";

/** Owner-or-admin gate; returns the doove's workspace for tag validation. */
async function authorizeDoove(request: Request, dooveId: string): Promise<{ workspaceId: string }> {
	const u = await requireUser(request);
	const db = getDb();
	const [r] = await db
		.select({ ownerId: doove.ownerId, workspaceId: doove.workspaceId })
		.from(doove)
		.where(eq(doove.id, dooveId))
		.limit(1);
	if (!r) error(404, "Doove not found");
	if (r.ownerId !== u.id) {
		const [usr] = await db
			.select({ role: user.role })
			.from(user)
			.where(eq(user.id, u.id))
			.limit(1);
		if (usr?.role !== "admin") error(403, "Not allowed to modify this doove");
	}
	return { workspaceId: r.workspaceId };
}

/** GET /api/dooves/[id]/tags — the doove's current tags. */
export const GET: RequestHandler = async ({ params, request }) => {
	await authorizeDoove(request, params.id);
	const db = getDb();
	const rows = await db
		.select({ id: tag.id, name: tag.name, color: tag.color })
		.from(dooveTag)
		.innerJoin(tag, eq(dooveTag.tagId, tag.id))
		.where(eq(dooveTag.dooveId, params.id));
	return json({ ok: true, tags: rows });
};

/**
 * PUT /api/dooves/[id]/tags — replace the doove's tag set wholesale.
 * Body: { tagIds: string[] }. Every id must be a tag in the doove's own
 * workspace. Empty array clears all tags.
 */
export const PUT: RequestHandler = async ({ params, request }) => {
	const { workspaceId } = await authorizeDoove(request, params.id);

	let body: { tagIds?: unknown } = {};
	try {
		body = (await request.json()) as typeof body;
	} catch {
		error(400, "Invalid JSON body");
	}
	if (!Array.isArray(body.tagIds)) error(400, "tagIds must be an array");
	const unique = [...new Set(body.tagIds.filter((x): x is string => typeof x === "string"))];

	const db = getDb();

	// Reject ids that don't belong to this workspace — no cross-workspace tags.
	if (unique.length > 0) {
		const valid = await db
			.select({ id: tag.id })
			.from(tag)
			.where(and(eq(tag.workspaceId, workspaceId), inArray(tag.id, unique)));
		if (valid.length !== unique.length) {
			error(400, "One or more tags don't belong to this workspace");
		}
	}

	await db.transaction(async (tx) => {
		await tx.delete(dooveTag).where(eq(dooveTag.dooveId, params.id));
		if (unique.length > 0) {
			await tx
				.insert(dooveTag)
				.values(unique.map((tagId) => ({ dooveId: params.id, tagId })));
		}
	});

	return json({ ok: true, tagIds: unique });
};
