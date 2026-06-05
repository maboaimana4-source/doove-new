<script lang="ts">
  import { page } from "$app/state";
  import CornerNotifications from "$components/corner-notifications.svelte";
  import AppSidebar from "$components/layout/app-sidebar.svelte";
  import CustomTitlebar from "$components/layout/custom-titlebar.svelte";
  import WhatsNewDialog from "$components/whats-new-dialog.svelte";
  import { config } from "$constants/app";
  import { updater } from "$lib/stores/updater.svelte";
  import { whatsNew } from "$lib/stores/whats-new.svelte";
  import * as Sidebar from "@doove/ui/sidebar";
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { fade } from "svelte/transition";

  import { goto } from "$app/navigation";
  import { listen } from "@tauri-apps/api/event";
  import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

  let { children } = $props();
  let routeKey = $derived(page.url.pathname);

  // On boot: surface the "What's new" corner card once per release (skip if
  // the user already landed on the changelog page), and kick off the
  // background update check. Both render as non-blocking bottom-right cards.
  onMount(async () => {
    // Basic telemetry ping
    try {
      let machineId = safeStorage.get("doove-machine-id", "");
      if (!machineId) {
        machineId = crypto.randomUUID();
        safeStorage.set("doove-machine-id", machineId);
      }
      const appVersion = await getVersion();
      const osType = platform();
      fetch("https://doove.imara.cloud/api/telemetry/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machine_id: machineId, os: osType, version: appVersion })
      }).catch(() => {});
    } catch (e) {}

    const unlistenSettings = listen<{ tab: string }>("open-settings", async (event) => {
      // Focus the main window
      const mainWin = await WebviewWindow.getByLabel("main");
      if (mainWin) {
        await mainWin.setFocus();
      }
      // Navigate to settings with the tab param (if supported) or just settings
      // Our settings page doesn't currently use a URL param for tabs, it uses local state.
      // But we can improve it.
      await goto(`/settings?tab=${event.payload.tab}`);
    });

    if (page.url.pathname.startsWith("/whats-new")) {
      whatsNew.markSeen();
    } else {
      whatsNew.evaluateOnBoot();
    }
    updater.init();
  });
</script>

<Sidebar.Provider class="h-full min-h-full fixed inset-0">
  <AppSidebar />
  <Sidebar.Inset class="@container/layout">
    <CustomTitlebar class="items-center gap-1 px-3">
      <div
        class="flex h-full items-center gap-2 font-sans"
        data-tauri-drag-region
      >
        <div
          in:fade={{ duration: 180, delay: 100, easing: cubicOut }}
          out:fade={{ duration: 140, easing: cubicOut }}
        >
          <Sidebar.Trigger
            class="size-7 rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            title="Pin / unpin sidebar (⌘B)"
          />
        </div>
        <span
          class="pointer-events-none select-none text-[13px] font-semibold tracking-tight text-foreground/80"
          data-tauri-drag-region
        >
          {config.appName}
        </span>
        <span
          class="pointer-events-none select-none text-[11px] font-medium text-muted-foreground/60"
          data-tauri-drag-region
        >
          ·
        </span>
        <span
          class="pointer-events-none select-none truncate capitalize text-[11px] font-medium text-muted-foreground/80"
          data-tauri-drag-region
        >
          {routeKey === "/"
            ? "Home"
            : routeKey.replace(/^\//, "").split("/")[0]}
        </span>
      </div>
      <div class="h-full flex-1" data-tauri-drag-region></div>
    </CustomTitlebar>
    <main class="flex-1 overflow-hidden no-scrollbar">
      <div class="h-full">
        {@render children()}
      </div>
    </main>
  </Sidebar.Inset>
</Sidebar.Provider>

<WhatsNewDialog />
<CornerNotifications />
