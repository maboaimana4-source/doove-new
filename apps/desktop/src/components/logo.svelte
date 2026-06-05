<script lang="ts">
  import { onMount } from "svelte";
  import { safeStorage } from "@doove/ui/persisted-state";
  type Theme = "light" | "dark" | "system";

  let currentTheme = $state<Theme>("system");
  onMount(() => {
    currentTheme = safeStorage.get<Theme>("mode-watcher-mode", currentTheme);
  });

  let {
    size = "512",
    ...rest
  } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 1024 1024"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  {...rest}
>
  <rect width="1024" height="1024" rx="220" fill="url(#paint0_linear_doove)"/>
  <path d="M300 300V724H512C629.081 724 724 629.081 724 512C724 394.919 629.081 300 512 300H300ZM412 412H512C567.228 412 612 456.772 612 512C612 567.228 567.228 612 512 612H412V412Z" fill="white"/>
  <circle cx="460" cy="512" r="50" fill="white" fill-opacity="0.8"/>
  <defs>
    <linearGradient id="paint0_linear_doove" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7C3AED"/>
      <stop offset="1" stop-color="#3B82F6"/>
    </linearGradient>
  </defs>
</svg>
