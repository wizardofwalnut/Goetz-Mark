# Playtest files

Two standalone HTML pages for tuning away from the repo. Each is a single file
with everything inlined — no server, no build, no network. Open on a phone, or
attach to a chat with Claude.

Regenerate after changing combat numbers or the map:

```bash
npm run playtest
```

## combat-tuner.html

Muster two armies, pick stances and ground, and read the full round-by-round
breakdown. Every unit stat, stance profile, terrain modifier and counter bonus
is editable, and the battle re-resolves as you change them.

**Tuning loop:** adjust numbers → hit *Export tuning* → paste the JSON into a
chat with Claude Code and say "apply this tuning". It maps onto
`src/content/units.ts` and `src/domain/combat/battleResolver.ts`. Editing the
page never touches the repo on its own.

The engagement seed is derived from the muster, so the same armies always
resolve the same way — a change in the result is caused by your edit, not by
variance. *Re-roll engagement* is there for when you do want a different roll.

## aldermarch-map.html

The map with real terrain tiles. Tap a county for its terrain, resource, yield,
build slots, movement cost, defence multiplier and borders (roads marked).

## What is real and what is a snapshot

The map, unit stats, stance profiles, terrain modifiers and the counter table
are **imported from source** at build time — they cannot drift from the repo.

The combat algorithm in `combat-tuner.html` is a hand port of
`src/domain/combat/battleResolver.ts` into plain JS, because the page has to run
with no build step. It is the one thing that could drift: if the resolver logic
changes materially, re-run `npm run playtest`.
