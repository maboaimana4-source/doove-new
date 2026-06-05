<script lang="ts">
	import type { Folder, Tag } from "$lib/dashboard/library.svelte";
	import type { Doove } from "$lib/dashboard/store.svelte";
	import EmptyState from "./EmptyState.svelte";
	import DooveCard from "./DooveCard.svelte";
	import { Button } from "@doove/ui/button";
	import { Film, LoaderCircle, Upload } from "@lucide/svelte";
	import { flip } from "svelte/animate";
	import { cubicOut } from "svelte/easing";
	import { scale } from "svelte/transition";

	// Responsive doove grid + its three empty states (no dooves / no match /
	// empty folder). Extracted from the library page so the page keeps only the
	// data + handlers.
	let {
		dooves,
		folders,
		tags,
		selectedIds = new Set<string>(),
		selectionMode = false,
		hasAnyDooves,
		filtersActive,
		uploading = false,
		uploadLabel = "",
		onplay,
		onrename,
		oncopylink,
		onchangeposter,
		ontogglesource,
		onmove,
		ontoggletag,
		ondelete,
		onToggleSelect,
		onupload,
		onclearfilters,
	}: {
		dooves: Doove[];
		folders: Folder[];
		tags: Tag[];
		selectedIds?: Set<string>;
		selectionMode?: boolean;
		hasAnyDooves: boolean;
		filtersActive: boolean;
		uploading?: boolean;
		uploadLabel?: string;
		onplay: (rec: Doove) => void;
		onrename: (rec: Doove) => void;
		oncopylink: (rec: Doove) => void;
		onchangeposter?: (rec: Doove) => void;
		ontogglesource: (rec: Doove) => void;
		onmove: (rec: Doove, folderId: string | null) => void;
		ontoggletag: (rec: Doove, tagId: string) => void;
		ondelete: (rec: Doove) => void;
		onToggleSelect: (rec: Doove) => void;
		onupload: () => void;
		onclearfilters: () => void;
	} = $props();
</script>

{#if dooves.length > 0}
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
		{#each dooves as rec (rec.id)}
			<div
				animate:flip={{ duration: 320, easing: cubicOut }}
				in:scale={{ start: 0.97, duration: 300, easing: cubicOut }}
				out:scale={{ start: 0.97, duration: 170, easing: cubicOut }}
			>
				<DooveCard
					doove={rec}
					{folders}
					{tags}
					selectable
					selected={selectedIds.has(rec.id)}
					{selectionMode}
					onToggleSelect={() => onToggleSelect(rec)}
					onplay={() => onplay(rec)}
					onrename={() => onrename(rec)}
					oncopylink={() => oncopylink(rec)}
					onchangeposter={onchangeposter ? () => onchangeposter(rec) : undefined}
					ontogglesource={() => ontogglesource(rec)}
					onmove={(folderId) => onmove(rec, folderId)}
					ontoggletag={(tagId) => ontoggletag(rec, tagId)}
					ondelete={() => ondelete(rec)}
				/>
			</div>
		{/each}
	</div>
{:else if !hasAnyDooves}
	<EmptyState icon={Film} title="No dooves yet" description="Upload an MP4, or capture and export one with the Doove desktop app.">
		<Button size="sm" class="gap-2" disabled={uploading} onclick={onupload}>
			{#if uploading}<LoaderCircle class="size-3.5 animate-spin" />{:else}<Upload class="size-3.5" />{/if}
			{uploading ? uploadLabel : "Upload doove"}
		</Button>
	</EmptyState>
{:else if filtersActive}
	<EmptyState icon={Film} title="No dooves match" description="Nothing here matches your search, folder, and tag filters.">
		<Button variant="outline" size="sm" onclick={onclearfilters}>Clear filters</Button>
	</EmptyState>
{:else}
	<EmptyState icon={Film} title="This folder is empty" description="Drag a doove onto it, or use “Move to” from a doove's menu." />
{/if}
