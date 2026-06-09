import {
  DEFAULT_HACK_TRACK_ID,
  DEFAULT_LEVEL_TRACK_ID,
  DEFAULT_LOADING_TRACK_ID,
} from "@/lib/audio/Sound.js";

const CARL = "Carl Fearby";

/** Per-track soundtrack credits — tongue firmly in cheek. */
export const TRACK_SONG_CREDITS = Object.freeze({
  "galactic-drifter": [
    ["Official Mood", "Staring At A Progress Bar"],
    ["Written during", "npm install (still running)"],
    ["Tempo", "Slower Than Your Download"],
    ["Key", "Waiting Minor"],
    ["Time Signature", "4/4 Until The Bar Stops"],
    ["Inspired by", "The spinning VX-27 logo"],
    ["Lyrics", "None (Carl was busy loading)"],
    ["Composed by", "Fay Brace"],
    ["Arranged by", "Clay Faber"],
    ["Programmed by", "Ray Cable"],
    ["Mixed by", "Alf Bracey"],
    ["Mastered by", "Earl Farby"],
    ["Mixer Notes", "More reverb than progress"],
    ["Plays When", "Carl tests 'one more thing'"],
    ["Grammy Category", "Best Loading Screen Anthem"],
    ["Streaming Revenue", "Paid in exposure"],
    ["Vocals", "Carl Fearby (mumbling 'almost there')"],
    ["Executive Producer", CARL],
    ["Published by", `${CARL} Productions`],
    ["Rights", "All rites reserved for the loading cult"],
  ],
  "galactic-drifter-2": [
    ["Subtitle", "The Driftening Continues"],
    ["Sequel Because", "Carl had one more MIDI file"],
    ["Features", "47% More Galactic, 12% More Drift"],
    ["Written by", "Cyra Fable"],
    ["Produced by", "Cary Baler"],
    ["Composed while", "Carl walked into pillars repeatedly"],
    ["Combat Mix", "Duck under gunfire (unimplemented)"],
    ["Loop Length", "Long enough to forget which room"],
    ["BPM", "Exactly one sprint per bar"],
    ["Player Feedback", "'Can we skip this?' — Carl, playtesting"],
    ["Licensed for", "Indoor arena violence only"],
    ["Not Licensed for", "Actual galactic drifting"],
    ["Co-Produced by", "Ralf Bayer"],
    ["Performed by", "The Carl Fearby Anagram Players"],
    ["All Instruments", "A laptop and hope"],
    ["Soundcheck", "Passed (Carl was the only listener)"],
    ["Vocals", "Carl Fearby (uncredited, again)"],
    ["Executive Music Producer", CARL],
    ["Published by", `${CARL} Productions`],
    ["In Memoriam", "Your ears, briefly"],
  ],
});

/** @param {string} trackId */
export function trackUsageLabel(trackId) {
  if (trackId === DEFAULT_LOADING_TRACK_ID) return "Loading Screen Theme";
  if (trackId === DEFAULT_LEVEL_TRACK_ID) return "In-Game Theme";
  if (trackId === DEFAULT_HACK_TRACK_ID) return "NODE BREACH Theme";
  return "Original Soundtrack";
}

/** @param {string} trackId */
export function trackTagline(trackId) {
  if (trackId === DEFAULT_LOADING_TRACK_ID) {
    return "The anthem of patience. Side effects may include checking the router.";
  }
  if (trackId === DEFAULT_LEVEL_TRACK_ID) {
    return "Now with 100% more gameplay. Carl insists you will feel the drift.";
  }
  if (trackId === DEFAULT_HACK_TRACK_ID) {
    return "Neon gates, rushed decisions, zero refunds on breached nodes.";
  }
  return "A Carl Fearby joint. No refunds on vibes.";
}
