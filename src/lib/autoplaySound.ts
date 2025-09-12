// A tiny global unlocker to enable autoplay with sound after a minimal user gesture.
// Works across modern browsers by retrying registered callbacks on first interaction.

let unlocked = false;
let setupDone = false;
const pending: Array<() => void> = [];

function onFirstInteraction() {
  if (unlocked) return;
  unlocked = true;
  // Run pending callbacks safely
  while (pending.length) {
    const cb = pending.shift();
    try {
      cb && cb();
    } catch {
      // ignore
    }
  }
  // No need to keep listeners around
  document.removeEventListener("click", onFirstInteraction, true);
  document.removeEventListener("touchstart", onFirstInteraction, true);
  document.removeEventListener("keydown", onFirstInteraction, true);
}

function ensureSetup() {
  if (setupDone) return;
  setupDone = true;
  document.addEventListener("click", onFirstInteraction, true);
  document.addEventListener("touchstart", onFirstInteraction, true);
  document.addEventListener("keydown", onFirstInteraction, true);
}

// Register a callback to be executed immediately if unlocked,
// or after the first user interaction otherwise.
export function onUserInteractionUnlock(cb: () => void) {
  if (unlocked) {
    try {
      cb();
    } catch {
      // ignore
    }
    return;
  }
  ensureSetup();
  pending.push(cb);
}

// Helper to force a video element to play at full volume with sound.
export async function playWithSound(video: HTMLVideoElement) {
  try {
    video.muted = false;
    // Clamp volume defensively
    video.volume = 1;
    // Mark as user-unmuted so other logic won't re-mute it
    (video as any).dataset.userUnmuted = "1";
    await video.play();
  } catch (err: any) {
    // Some browsers throw NotAllowedError until a gesture
    throw err;
  }
}
