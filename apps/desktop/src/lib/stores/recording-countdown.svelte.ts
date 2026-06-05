/**
 * The "count down before capture starts" setting, shared between the Settings →
 * Recording panel (where it's chosen) and the recording panel window (where it's
 * applied). Backed by the shared `PersistedState` primitive so the two windows
 * stay in sync: Tauri v2 webviews share a localStorage origin, so changing the
 * value in Settings reaches an already-open panel live via the `storage` event,
 * no relaunch — the panel no longer needs its own listener.
 *
 * Stored as a raw number string (e.g. `"3"`), matching the historical on-disk
 * format; `PersistedState`'s number serializer reads it back and falls back to
 * the default on `NaN`. `value` additionally coerces to a known option so a
 * stale / out-of-range stored number can never reach the UI.
 */

import { PersistedState } from "@doove/ui/persisted-state";

export type CountdownSeconds = 0 | 3 | 5 | 10;

const STORAGE_KEY = "doove-recording-countdown";
const VALID: readonly CountdownSeconds[] = [0, 3, 5, 10];
const DEFAULT: CountdownSeconds = 3;

function coerce(n: number): CountdownSeconds {
	return (VALID as readonly number[]).includes(n) ? (n as CountdownSeconds) : DEFAULT;
}

function createRecordingCountdownStore() {
	const store = new PersistedState<number>(STORAGE_KEY, DEFAULT);

	return {
		/** Current countdown in seconds, coerced to a valid option (0/3/5/10). */
		get value(): CountdownSeconds {
			return coerce(store.current);
		},
		set(value: CountdownSeconds) {
			store.current = value;
		},
	};
}

export const recordingCountdown = createRecordingCountdownStore();
