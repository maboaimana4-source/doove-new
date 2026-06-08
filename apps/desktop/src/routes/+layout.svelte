<script lang="ts">
  import "@fontsource-variable/google-sans";
  import { TooltipProvider } from "@doove/ui/tooltip";
  import "../app.css";
  // DoovePlayer theme — needs to load once globally so any route that
  // mounts <DoovePlayer> (exports preview, future inline players) picks
  // up the branded media-chrome styling.
  import "@doove/player/styles.css";

  import { onNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { launchRecordingPanel } from "$lib/ipc";
  import { openProjectFromExternalPath } from "$lib/openProject";
  import { updater } from "$lib/stores/updater.svelte";
  import CommandPaletteHost from "$components/layout/CommandPaletteHost.svelte";
  import ShortcutsDialog from "$components/layout/ShortcutsDialog.svelte";
  import { dispatchShortcut } from "$lib/shortcuts/registry.svelte";
  import FirstRunConsent from "$components/FirstRunConsent.svelte";
  import { analytics } from "$lib/analytics/client";
  import { desktopConsent } from "$lib/stores/consent.svelte";
  import { initAssets } from "$lib/assets";
  import { initExtensions } from "$lib/extensions";
  import { NavProgress } from "@doove/ui/nav-progress";
  import { getTauriTheme, isTauriApp } from "$lib/runtime/tauri";
  import { Toaster, toast } from "@doove/ui/sonner";
  import { ModeWatcher, setMode } from "@doove/ui/theme";
  import { safeStorage } from "@doove/ui/persisted-state";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { onMount, tick } from "svelte";
  import { log } from "$lib/logger";

  let { children } = $props();

  // First-run privacy prompt — shown once in the main window only.
  let showFirstRun = $state(false);

  const TRANSPARENT_ROUTES = [
    "/camera-preview",
    "/device-picker",
    "/profile-picker",
    "/select",
    "/panel",
  ];
  const isTransparentRoute = $derived(
    TRANSPARENT_ROUTES.some((p) => page.url.pathname.startsWith(p)),
  );

  function removeSplash() {
    const boot = document.getElementById("boot");
    if (boot) {
      boot.classList.add("boot-leaving");
      setTimeout(() => boot.remove(), 280);
    }
  }

  onMount(() => {
    // konsolidace onMount
    let cancelled = false;
    let unlistenAuth: (() => void) | undefined;
    let unlistenToast: (() => void) | undefined;
    let unlistenToggle: (() => void) | undefined;
    let unlistenUpdates: (() => void) | undefined;
    let unlistenOpen: (() => void) | undefined;

    const setup = async () => {
      // Remove splash as soon as possible after mount
      await tick();
      removeSplash();

      if (isTransparentRoute) return;

      const tauri = await isTauriApp();
      if (!tauri) return;

      const { getCurrentWebviewWindow, getAllWebviewWindows } = await import(
        "@tauri-apps/api/webviewWindow"
      );
      const win = getCurrentWebviewWindow();
      const isMain = win.label === "main";

      if (isMain) {
        // Analytics
        try {
          const { platform } = await import("@tauri-apps/plugin-os");
          analytics.register({ os: platform() });
        } catch {}
        analytics.capture("app_opened");

        if (!desktopConsent.hasSeenFirstRun) showFirstRun = true;

        const authUnlisten = await listen<{ userId?: string | null }>(
          "auth:signed-in",
          ({ payload }) => {
            if (payload?.userId) analytics.identify(payload.userId);
            analytics.capture("cloud_connected");
          },
        );
        if (cancelled) authUnlisten();
        else unlistenAuth = authUnlisten;

        // Tray record toggle
        const toggleUnlisten = await listen("tray:record-toggle", async () => {
          const all = await getAllWebviewWindows();
          const hasPanel = all.some((w) => w.label === "recording-panel");
          if (hasPanel) return;
          void launchRecordingPanel();
        });
        if (cancelled) toggleUnlisten();
        else unlistenToggle = toggleUnlisten;

        // Tray update check
        const updatesUnlisten = await listen("updater:check-from-tray", () => {
          void updater.checkNow();
        });
        if (cancelled) updatesUnlisten();
        else unlistenUpdates = updatesUnlisten;

        // File association cold start
        try {
          const pending = await invoke<string | null>("take_pending_open_file");
          if (!cancelled && pending) {
            void openProjectFromExternalPath(pending);
          }
        } catch (e) {
          console.warn("[open-doove] cold-start drain failed", e);
        }

        // File association warm start
        const openUnlisten = await listen<string>(
          "app://open-doove",
          ({ payload }) => {
            if (!payload) return;
            void openProjectFromExternalPath(payload);
          },
        );
        if (cancelled) openUnlisten();
        else unlistenOpen = openUnlisten;

        // Theme sync
        const theme = await getTauriTheme();
        const stored = safeStorage.get<string>("mode-watcher-mode", "");
        if (theme && (!stored || stored === "system")) {
          setMode(theme);
        }
      }

      // Toast bridge
      const toastUnlisten = await listen<any>("ui:toast", ({ payload }) => {
        const opts = payload.duration ? { duration: payload.duration } : undefined;
        switch (payload.level) {
          case "error": toast.error(payload.message, opts); break;
          case "warning": toast.warning(payload.message, opts); break;
          case "success": toast.success(payload.message, opts); break;
          default: toast.info(payload.message, opts);
        }
      });
      if (cancelled) toastUnlisten();
      else unlistenToast = toastUnlisten;
    };

    void setup();

    // Global error capture
    const onError = (e: ErrorEvent) =>
      analytics.captureError(e.error ?? e.message, {
        source: "desktop",
        route: page.url.pathname,
      });
    const onRejection = (e: PromiseRejectionEvent) =>
      analytics.captureError(e.reason, {
        source: "desktop",
        route: page.url.pathname,
      });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      cancelled = true;
      unlistenAuth?.();
      unlistenToast?.();
      unlistenToggle?.();
      unlistenUpdates?.();
      unlistenOpen?.();
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  });

  onNavigate((navigation) => {
    if (typeof document === "undefined") return;
    if (!("startViewTransition" in document)) return;

    const to = navigation.to?.url.pathname ?? "";
    const from = navigation.from?.url.pathname ?? "";
    const isOverlay = (p: string) =>
      TRANSPARENT_ROUTES.some((r) => p.startsWith(r));
    if (isOverlay(to) || isOverlay(from)) return;

    document.documentElement.dataset.navDirection =
      to.length >= from.length ? "forward" : "back";

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });

  initAssets();
  initExtensions();

  function logKeyDiagnostic(e: KeyboardEvent) {
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) return;
    const t = e.target as HTMLElement | null;
    log.debug("input", "keydown", {
      key: e.key,
      code: e.code,
      ctrl: e.ctrlKey,
      meta: e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
      repeat: e.repeat,
      target: t?.tagName?.toLowerCase() ?? null,
      route: page.url.pathname,
    });
  }

  const BARE_MODIFIER_KEYS = new Set([
    "Control",
    "Shift",
    "Alt",
    "Meta",
    "OS",
    "AltGraph",
  ]);
  $effect(() => {
    const swallowBareModifier = (e: KeyboardEvent) => {
      if (BARE_MODIFIER_KEYS.has(e.key)) e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", swallowBareModifier, { capture: true });
    return () =>
      window.removeEventListener("keydown", swallowBareModifier, {
        capture: true,
      });
  });
</script>

<svelte:window
  onkeydown={(e) => {
    logKeyDiagnostic(e);
    if (!isTransparentRoute) dispatchShortcut(e);
  }}
/>

<TooltipProvider>
  <NavProgress />
  <ModeWatcher />
  {#if !isTransparentRoute}
    <Toaster />
    <CommandPaletteHost />
    <ShortcutsDialog />
  {/if}
  <div
    class="relative flex min-h-screen min-w-dvw w-full flex-col {isTransparentRoute
      ? 'bg-transparent'
      : 'bg-background'}"
  >
    {@render children()}
  </div>
  {#if showFirstRun}
    <FirstRunConsent onclose={() => (showFirstRun = false)} />
  {/if}
</TooltipProvider>
