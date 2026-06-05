import { sql } from "drizzle-orm";
import { doove, share } from "$lib/db/schema";

/**
 * Correlated-subquery select fragments for doove list loaders. Extracted so
 * the home, library, analytics, and API loaders share ONE definition each —
 * previously these were copy-pasted across four files, and drift (e.g. one
 * loader counting views differently) would silently desync the dashboards.
 *
 * Each returns a fresh `sql` fragment that correlates to the outer `doove`
 * table, so use them inside `.select({ ... }).from(doove)`.
 */

/** Total views for a doove = sum of its shares' cached view counts. */
export function dooveViewsSql() {
	return sql<number>`COALESCE((
		SELECT SUM(${share.viewsCount})
		FROM ${share}
		WHERE ${share.dooveId} = ${doove.id}
	), 0)`;
}

/** Slug of the doove's most recent share, or null if never shared. */
export function dooveLatestShareSlugSql() {
	return sql<string | null>`(
		SELECT ${share.slug}
		FROM ${share}
		WHERE ${share.dooveId} = ${doove.id}
		ORDER BY ${share.createdAt} DESC
		LIMIT 1
	)`;
}

/** Tag-id array for a doove (`[]` when untagged), resolved in the UI. */
export function dooveTagIdsSql() {
	return sql<string[]>`COALESCE((
		SELECT json_agg(rt.tag_id)
		FROM doove_tag rt
		WHERE rt.doove_id = ${doove.id}
	), '[]'::json)`;
}
