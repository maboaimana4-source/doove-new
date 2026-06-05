<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import * as api from "$lib/dashboard/api";
	import ArchivedCard, { type ArchivedDoove } from "$lib/dashboard/components/ArchivedCard.svelte";
	import EmptyState from "$lib/dashboard/components/EmptyState.svelte";
	import FolderRail, { type FolderSelection } from "$lib/dashboard/components/FolderRail.svelte";
	import LibraryToolbar from "$lib/dashboard/components/LibraryToolbar.svelte";
	import PageHeader from "$lib/dashboard/components/PageHeader.svelte";
	import PlayerDialog from "$lib/dashboard/components/PlayerDialog.svelte";
	import DooveGrid from "$lib/dashboard/components/DooveGrid.svelte";
	import RenameDialog from "$lib/dashboard/components/RenameDialog.svelte";
	import SelectionBar from "$lib/dashboard/components/SelectionBar.svelte";
	import TagManagerDialog from "$lib/dashboard/components/TagManagerDialog.svelte";
	import { mapDoovesForStore } from "$lib/dashboard/hydrate";
	import { foldersStore, tagsStore } from "$lib/dashboard/library.svelte";
	import {
		doovesStore,
		type Doove,
		type RecordingSource,
	} from "$lib/dashboard/store.svelte";
	import { POSTER_ACCEPT, replacePoster } from "$lib/dashboard/poster";
	import { UPLOAD_ACCEPT, uploadDooveFile, type UploadPhase } from "$lib/dashboard/upload";
	import { Archive, FolderOpen, Library, LoaderCircle, Upload, UploadCloud } from "@lucide/svelte";
	import { Button } from "@doove/ui/button";
	import { toast } from "@doove/ui/sonner";
	import { untrack } from "svelte";
	import { flip } from "svelte/animate";
	import { cubicOut } from "svelte/easing";
	import { fly, scale, slide } from "svelte/transition";

	let { data } = $props();

	// Hydrate dooves + folders + tags from the server.
	$effect(() => {
		const mapped = mapDoovesForStore(data.dooves);
		const folders = data.folders;
		const tags = data.tags;
		untrack(() => {
			doovesStore.hydrate(mapped);
			foldersStore.hydrate(folders);
			tagsStore.hydrate(tags);
		});
	});

	const workspaceId = $derived(data.workspaceId);

	// Archived dooves live in their own tab. Keep a local copy so a delete can
	// drop the card optimistically; re-seed whenever the loader returns fresh data.
	let archived = $state<ArchivedDoove[]>([]);
	$effect(() => {
		const next = data.archived;
		untrack(() => (archived = next));
	});

	type View = "library" | "archived";
	let view = $state<View>("library");

	let query = $state("");
	let activeFilter = $state<RecordingSource | "all">("all");
	let sortKey = $state<string>("recent");
	let selectedFolder = $state<FolderSelection>("all");
	let selectedTagIds = $state<string[]>([]);

	let playing = $state<Doove | null>(null);
	let renaming = $state<Doove | null>(null);
	let managingTags = $state(false);

	// Bulk selection.
	let selectedIds = $state(new Set<string>());
	const selectionMode = $derived(selectedIds.size > 0);

	// Upload (shared by the header button, the empty-state button, the file
	// input, and drag-and-drop).
	let uploading = $state(false);
	let uploadPhase = $state<UploadPhase>("preparing");
	let uploadPct = $state(0);
	let fileInput = $state<HTMLInputElement | null>(null);
	let dragDepth = $state(0);
	const isDraggingFile = $derived(dragDepth > 0);

	const uploadLabel = $derived(
		uploadPhase === "uploading"
			? `Uploading ${uploadPct}%`
			: uploadPhase === "finalizing"
				? "Finalizing…"
				: uploadPhase === "sharing"
					? "Creating link…"
					: "Preparing…",
	);

	function matchesFolder(r: Doove): boolean {
		if (selectedFolder === "all") return true;
		if (selectedFolder === "root") return !r.folderId;
		return r.folderId === selectedFolder;
	}
	// Tag filter is OR — show dooves carrying ANY of the selected tags.
	function matchesTags(r: Doove): boolean {
		if (selectedTagIds.length === 0) return true;
		return selectedTagIds.some((id) => r.tags.includes(id));
	}

	const visible = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const list = doovesStore.items.filter(
			(r) =>
				(activeFilter === "all" || r.source === activeFilter) &&
				matchesFolder(r) &&
				matchesTags(r) &&
				r.title.toLowerCase().includes(q),
		);
		return [...list].sort((a, b) => {
			switch (sortKey) {
				case "oldest":
					return a.createdAt - b.createdAt;
				case "name":
					return a.title.localeCompare(b.title);
				case "largest":
					return b.sizeBytes - a.sizeBytes;
				default:
					return b.createdAt - a.createdAt;
			}
		});
	});

	const hasDooves = $derived(doovesStore.items.length > 0);
	const filtersActive = $derived(
		query.trim() !== "" || activeFilter !== "all" || selectedFolder !== "all" || selectedTagIds.length > 0,
	);
	const folderCrumb = $derived(
		typeof selectedFolder === "string" && selectedFolder !== "all" && selectedFolder !== "root"
			? foldersStore.breadcrumb(selectedFolder)
			: [],
	);

	function clearFilters() {
		query = "";
		activeFilter = "all";
		selectedFolder = "all";
		selectedTagIds = [];
	}

	// ── Selection ──────────────────────────────────────────────────────
	function toggleSelect(rec: Doove) {
		const next = new Set(selectedIds);
		if (next.has(rec.id)) next.delete(rec.id);
		else next.add(rec.id);
		selectedIds = next;
	}
	function clearSelection() {
		selectedIds = new Set();
	}

	// ── Upload ─────────────────────────────────────────────────────────
	async function startUpload(file: File) {
		if (uploading) return;
		uploading = true;
		uploadPhase = "preparing";
		uploadPct = 0;
		try {
			const result = await uploadDooveFile(file, {
				workspaceId,
				onPhase: (p) => (uploadPhase = p),
				onProgress: (pct) => (uploadPct = pct),
			});
			await invalidateAll();
			let copied = false;
			try {
				await navigator.clipboard.writeText(result.shareUrl);
				copied = true;
			} catch {
				copied = false;
			}
			toast.success(
				copied
					? `“${file.name}” uploaded — share link copied to clipboard.`
					: `“${file.name}” uploaded and shared.`,
			);
		} catch (err) {
			toast.error((err as Error)?.message ?? "Couldn't upload that file.");
		} finally {
			uploading = false;
		}
	}

	function onFilePicked(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = "";
		if (file) startUpload(file);
	}

	// Only react to external FILE drags — internal card→folder drags carry
	// "text/doove-id", so they never trip the upload overlay.
	function isFileDrag(e: DragEvent): boolean {
		return Array.from(e.dataTransfer?.types ?? []).includes("Files");
	}
	function onDragEnter(e: DragEvent) {
		if (!isFileDrag(e)) return;
		e.preventDefault();
		dragDepth++;
	}
	function onDragOver(e: DragEvent) {
		if (!isFileDrag(e)) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
	}
	function onDragLeave(e: DragEvent) {
		if (!isFileDrag(e)) return;
		dragDepth = Math.max(0, dragDepth - 1);
	}
	function onDrop(e: DragEvent) {
		if (!isFileDrag(e)) return;
		e.preventDefault();
		dragDepth = 0;
		const file = e.dataTransfer?.files?.[0];
		if (file) startUpload(file);
	}

	// ── Mutations ──────────────────────────────────────────────────────
	async function doRename(rec: Doove, title: string) {
		renaming = null;
		const prev = rec.title;
		doovesStore.rename(rec.id, title);
		try {
			await api.renameDoove(rec.id, title);
			toast.success("Doove renamed.");
		} catch (e) {
			doovesStore.rename(rec.id, prev);
			toast.error((e as Error)?.message ?? "Couldn't rename.");
		}
	}

	function toggleSource(rec: Doove) {
		const next: RecordingSource = rec.source === "cloud" ? "local" : "cloud";
		doovesStore.setSource(rec.id, next);
		toast.success(next === "cloud" ? "Uploaded to Cloudinary." : "Moved to local storage.");
	}

	async function moveDoove(rec: Doove, folderId: string | null) {
		if (rec.folderId === folderId) return;
		const prev = rec.folderId;
		doovesStore.move(rec.id, folderId);
		try {
			await api.moveDoove(rec.id, folderId);
			const name = folderId ? foldersStore.get(folderId)?.name ?? "folder" : "No folder";
			toast.success(`Moved to ${name}.`);
		} catch (e) {
			doovesStore.move(rec.id, prev);
			toast.error((e as Error)?.message ?? "Couldn't move doove.");
		}
	}

	async function toggleTag(rec: Doove, tagId: string) {
		const prev = rec.tags;
		const next = prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId];
		doovesStore.setTags(rec.id, next);
		try {
			await api.setDooveTags(rec.id, next);
		} catch (e) {
			doovesStore.setTags(rec.id, prev);
			toast.error((e as Error)?.message ?? "Couldn't update tags.");
		}
	}

	// ── Replace poster (cloud dooves only) ─────────────────────────────
	let posterInput = $state<HTMLInputElement | null>(null);
	let posterTargetId = $state<string | null>(null);

	function changePoster(rec: Doove) {
		if (rec.source !== "cloud") {
			toast.error("Upload this doove to the cloud first to set a poster.");
			return;
		}
		posterTargetId = rec.id;
		posterInput?.click();
	}

	async function onPosterPicked(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		const id = posterTargetId;
		input.value = "";
		posterTargetId = null;
		if (!file || !id) return;
		const pending = toast.loading("Updating poster…");
		try {
			const posterUrl = await replacePoster(id, file);
			if (posterUrl) doovesStore.setPoster(id, posterUrl);
			toast.success("Poster updated.", { id: pending });
		} catch (err) {
			toast.error((err as Error)?.message ?? "Couldn't update the poster.", { id: pending });
		}
	}

	async function copyLink(rec: Doove) {
		try {
			let slug = rec.latestShareSlug ?? null;
			if (!slug) {
				const { slug: newSlug } = await api.shareDoove(rec.id);
				slug = newSlug;
				doovesStore.setShareSlug(rec.id, slug);
			}
			await navigator.clipboard.writeText(`${location.origin}/share/${slug}`);
			toast.success("Share link copied to clipboard.");
		} catch (e) {
			toast.error((e as Error)?.message ?? "Couldn't copy the share link.");
		}
	}

	async function deleteDoove(rec: Doove) {
		const snapshot = doovesStore.items;
		doovesStore.remove(rec.id);
		if (playing?.id === rec.id) playing = null;
		try {
			await api.deleteDoove(rec.id);
			toast.success(`“${rec.title}” deleted.`);
		} catch (e) {
			doovesStore.hydrate(snapshot);
			toast.error((e as Error)?.message ?? "Couldn't delete doove.");
		}
	}

	// ── Bulk mutations ─────────────────────────────────────────────────
	function plural(n: number) {
		return n === 1 ? "" : "s";
	}

	async function bulkMove(folderId: string | null) {
		const ids = [...selectedIds];
		const snapshot = doovesStore.items;
		ids.forEach((id) => doovesStore.move(id, folderId));
		clearSelection();
		try {
			await Promise.all(ids.map((id) => api.moveDoove(id, folderId)));
			const name = folderId ? foldersStore.get(folderId)?.name ?? "folder" : "No folder";
			toast.success(`Moved ${ids.length} doove${plural(ids.length)} to ${name}.`);
		} catch (e) {
			doovesStore.hydrate(snapshot);
			toast.error((e as Error)?.message ?? "Couldn't move dooves.");
		}
	}

	async function bulkAddTag(tagId: string) {
		const ids = [...selectedIds];
		const snapshot = doovesStore.items;
		clearSelection();
		const updates = ids.map((id) => {
			const rec = snapshot.find((r) => r.id === id);
			const next = rec && !rec.tags.includes(tagId) ? [...rec.tags, tagId] : rec?.tags ?? [];
			doovesStore.setTags(id, next);
			return { id, next };
		});
		try {
			await Promise.all(updates.map((u) => api.setDooveTags(u.id, u.next)));
			toast.success(`Tagged ${ids.length} doove${plural(ids.length)}.`);
		} catch (e) {
			doovesStore.hydrate(snapshot);
			toast.error((e as Error)?.message ?? "Couldn't tag dooves.");
		}
	}

	async function bulkDelete() {
		const ids = [...selectedIds];
		const snapshot = doovesStore.items;
		ids.forEach((id) => doovesStore.remove(id));
		if (playing && ids.includes(playing.id)) playing = null;
		clearSelection();
		try {
			await Promise.all(ids.map((id) => api.deleteDoove(id)));
			toast.success(`Deleted ${ids.length} doove${plural(ids.length)}.`);
		} catch (e) {
			doovesStore.hydrate(snapshot);
			toast.error((e as Error)?.message ?? "Couldn't delete dooves.");
		}
	}

	async function deleteArchived(rec: ArchivedDoove) {
		const snapshot = archived;
		archived = archived.filter((a) => a.id !== rec.id);
		try {
			await api.deleteDoove(rec.id);
			toast.success(`“${rec.title}” deleted permanently.`);
		} catch (e) {
			archived = snapshot;
			toast.error((e as Error)?.message ?? "Couldn't delete doove.");
		}
	}

	async function createTag(name: string) {
		try {
			const tag = await api.createTag({ workspaceId, name });
			tagsStore.add(tag);
		} catch (e) {
			toast.error((e as Error)?.message ?? "Couldn't create tag.");
		}
	}
</script>

<svelte:head>
	<title>Dooves - Doove Dashboard</title>
</svelte:head>

<input bind:this={fileInput} type="file" accept={UPLOAD_ACCEPT} class="hidden" onchange={onFilePicked} />
<input bind:this={posterInput} type="file" accept={POSTER_ACCEPT} class="hidden" onchange={onPosterPicked} />

<PageHeader icon={Library} title="Dooves" subtitle="All your dooves — captured, uploaded, shared.">
	<Button class="gap-2" disabled={uploading} onclick={() => fileInput?.click()}>
		{#if uploading}<LoaderCircle class="size-4 animate-spin" />{:else}<Upload class="size-4" />{/if}
		{uploading ? uploadLabel : "Upload doove"}
	</Button>
</PageHeader>

<!-- Inline upload progress -->
{#if uploading}
	<div class="mt-4" transition:slide={{ duration: 200, easing: cubicOut }}>
		<div class="flex items-center justify-between text-xs text-muted-foreground">
			<span class="font-medium text-foreground">{uploadLabel}</span>
			{#if uploadPhase === "uploading"}<span class="font-mono tabular-nums">{uploadPct}%</span>{/if}
		</div>
		<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/8">
			<div
				class="h-full rounded-full bg-linear-to-r from-primary/70 to-primary transition-[width] duration-300 ease-[cubic-bezier(0.625,0.05,0,1)]"
				style="width: {uploadPhase === 'uploading' ? uploadPct : 100}%"
				class:animate-pulse={uploadPhase !== "uploading"}
			></div>
		</div>
	</div>
{/if}

<!-- View tabs: Library / Archived -->
<div class="mt-8 flex items-center gap-1 border-b border-border-low/60" in:fly={{ y: 12, duration: 480, delay: 200, easing: cubicOut }}>
	<button
		type="button"
		onclick={() => (view = "library")}
		class="-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors
			{view === 'library' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}"
	>
		<Library class="size-4" />
		Library
	</button>
	<button
		type="button"
		onclick={() => (view = "archived")}
		class="-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors
			{view === 'archived' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}"
	>
		<Archive class="size-4" />
		Archived
		{#if archived.length > 0}
			<span class="rounded-full bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">{archived.length}</span>
		{/if}
	</button>
</div>

{#if view === "library"}
	<!-- Library: folder rail + content. The whole region is a file drop target. -->
	<div
		role="region"
		aria-label="Doove library"
		class="relative mt-6 flex flex-col gap-6 lg:flex-row"
		in:fly={{ y: 12, duration: 480, delay: 80, easing: cubicOut }}
		ondragenter={onDragEnter}
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		<FolderRail
			{workspaceId}
			selected={selectedFolder}
			onselect={(s) => (selectedFolder = s)}
			onDropDoove={(dooveId, folderId) => {
				const rec = doovesStore.items.find((r) => r.id === dooveId);
				if (rec) moveDoove(rec, folderId);
			}}
		/>

		<div class="min-w-0 flex-1">
			<LibraryToolbar
				bind:query
				bind:activeFilter
				bind:sortKey
				bind:selectedTagIds
				total={doovesStore.items.length}
				shown={visible.length}
				{filtersActive}
				onclear={clearFilters}
				onmanagetags={() => (managingTags = true)}
				oncreatetag={createTag}
			/>

			<!-- Folder context line -->
			{#if folderCrumb.length > 0}
				<div class="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground" in:slide={{ duration: 200, easing: cubicOut }}>
					<FolderOpen class="size-4 text-primary" />
					{#each folderCrumb as f, i (f.id)}
						<button type="button" onclick={() => (selectedFolder = f.id)} class="transition-colors hover:text-foreground {i === folderCrumb.length - 1 ? 'font-medium text-foreground' : ''}">
							{f.name}
						</button>
						{#if i < folderCrumb.length - 1}<span class="text-muted-foreground/50">/</span>{/if}
					{/each}
				</div>
			{/if}

			<div class="mt-5">
				<DooveGrid
					dooves={visible}
					folders={foldersStore.items}
					tags={tagsStore.items}
					{selectedIds}
					{selectionMode}
					hasAnyDooves={hasDooves}
					{filtersActive}
					{uploading}
					{uploadLabel}
					onplay={(rec) => (playing = rec)}
					onrename={(rec) => (renaming = rec)}
					oncopylink={copyLink}
					onchangeposter={changePoster}
					ontogglesource={toggleSource}
					onmove={moveDoove}
					ontoggletag={toggleTag}
					ondelete={deleteDoove}
					onToggleSelect={toggleSelect}
					onupload={() => fileInput?.click()}
					onclearfilters={clearFilters}
				/>
			</div>
		</div>

		<!-- Drop-to-upload overlay -->
		{#if isDraggingFile}
			<div
				class="pointer-events-none absolute inset-0 z-30 grid place-items-center rounded-2xl border-2 border-dashed border-primary/60 bg-background/70 backdrop-blur-sm"
				transition:fly={{ y: 8, duration: 160, easing: cubicOut }}
			>
				<div class="flex flex-col items-center gap-2 text-center">
					<span class="glass-chip grid size-12 place-items-center rounded-xl text-primary">
						<UploadCloud class="size-5" />
					</span>
					<p class="text-sm font-semibold text-foreground">Drop to upload</p>
					<p class="text-xs text-muted-foreground">We'll upload, publish, and copy a share link.</p>
				</div>
			</div>
		{/if}
	</div>
{:else}
	<!-- Archived tab -->
	<div class="mt-6" in:fly={{ y: 12, duration: 480, delay: 80, easing: cubicOut }}>
		{#if archived.length > 0}
			<p class="mb-5 max-w-2xl text-sm text-muted-foreground">
				Dooves here lost their cloud file after 14 days without views — only the
				details remain. Re-share from the Doove desktop app to bring one back, or
				delete it for good. Each is purged automatically 16 days after archiving.
			</p>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{#each archived as rec (rec.id)}
					<div
						animate:flip={{ duration: 320, easing: cubicOut }}
						in:scale={{ start: 0.97, duration: 300, easing: cubicOut }}
						out:scale={{ start: 0.97, duration: 170, easing: cubicOut }}
					>
						<ArchivedCard doove={rec} ondelete={() => deleteArchived(rec)} />
					</div>
				{/each}
			</div>
		{:else}
			<EmptyState
				icon={Archive}
				title="Nothing archived"
				description="Unwatched dooves on the Free plan are archived after 14 days. Anything parked here shows up so you can restore or remove it."
			/>
		{/if}
	</div>
{/if}

{#if view === "library" && selectionMode}
	<SelectionBar
		count={selectedIds.size}
		folders={foldersStore.items}
		tags={tagsStore.items}
		onmove={bulkMove}
		onaddtag={bulkAddTag}
		ondelete={bulkDelete}
		onclear={clearSelection}
	/>
{/if}

{#if playing}
	<PlayerDialog
		doove={playing}
		onclose={() => (playing = null)}
		onengagement={(event) => {
			if (event.type === "view-start" && playing) {
				doovesStore.incrementViews(playing.id);
			}
		}}
	/>
{/if}

{#if renaming}
	<RenameDialog
		doove={renaming}
		onclose={() => (renaming = null)}
		onsave={(title) => renaming && doRename(renaming, title)}
	/>
{/if}

{#if managingTags}
	<TagManagerDialog onclose={() => (managingTags = false)} />
{/if}
