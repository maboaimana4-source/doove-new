import { persisted } from "@doove/ui/persisted-state";

export interface LicenseStatus {
    isPro: boolean;
    key: string | null;
    email: string | null;
}

export interface RecordingSession {
    timestamp: number;
    durationMs: number;
}

export const licenseStore = persisted<LicenseStatus>("doove-license", {
    isPro: false,
    key: null,
    email: null,
});

export const usageStore = persisted<RecordingSession[]>("doove-usage", []);

export function getTodayRecordings() {
    const today = new Date().setHours(0, 0, 0, 0);
    return usageStore.current.filter(s => new Date(s.timestamp).setHours(0, 0, 0, 0) === today);
}

export async function verifyLicense(key: string): Promise<boolean> {
    try {
        const response = await fetch("https://doove.imara.cloud/api/subscription/verify-key", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key }),
        });
        const data = await response.json();
        if (data.success) {
            licenseStore.current = {
                isPro: true,
                key: key,
                email: data.email || null,
            };
            return true;
        }
    } catch (e) {
        console.error("License verification failed", e);
    }
    return false;
}

export function canRecord(): { allowed: boolean; reason?: string } {
    if (licenseStore.current.isPro) return { allowed: true };

    const todayRecordings = getTodayRecordings();
    if (todayRecordings.length >= 3) {
        return { allowed: false, reason: "Limite de 3 enregistrements par jour atteinte. Passez à Doove Pro pour un accès illimité !" };
    }
    return { allowed: true };
}

export function checkDuration(durationMs: number): { allowed: boolean; reason?: string } {
    if (licenseStore.current.isPro) return { allowed: true };

    if (durationMs > 5 * 60 * 1000) {
        return { allowed: false, reason: "Les enregistrements gratuits sont limités à 5 minutes. Passez à Doove Pro pour un accès illimité !" };
    }
    return { allowed: true };
}

export function addRecording(durationMs: number) {
    usageStore.current = [...usageStore.current, { timestamp: Date.now(), durationMs }];
}
