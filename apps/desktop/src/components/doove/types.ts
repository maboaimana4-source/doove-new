import type { Component } from "svelte";

export type DooveIcon = Component<{ size?: number | string; class?: string }>;

export interface DooveAccessory {
	text?: string;
	icon?: DooveIcon;
	tooltip?: string;
	variant?: "default" | "success" | "warning" | "destructive" | "info";
}

export interface DooveAction {
	id: string;
	label: string;
	icon?: DooveIcon;
	shortcut?: string;
	variant?: "default" | "destructive";
	onAction: () => void | Promise<void>;
}

export type DooveLayout = "card" | "row";

export interface DooveListItem {
	id: string;
	title: string;
	subtitle?: string;
	icon?: DooveIcon;
	iconImage?: string;
	iconClass?: string;
	keywords?: string[];
	accessories?: DooveAccessory[];
	section?: string;
	layout?: DooveLayout;
	actions?: DooveAction[];
	onSelect?: () => void | Promise<void>;
}

export interface DooveSection {
	title: string;
	items: DooveListItem[];
}
