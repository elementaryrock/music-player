import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  getLyricRevealProgress,
  parseLrc,
  splitLyricText,
} from "../src/utils/lyrics.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("parseLrc keeps sorted lines, repeated timestamps, and offsets", () => {
  const lines = parseLrc(
    "[offset:500]\n[ti:Example]\n[00:03.00]second\n[00:01.00][00:02.00]first",
  );

  assert.deepEqual(
    lines.map(({ time, text }) => ({ time, text })),
    [
      { time: 1.5, text: "first" },
      { time: 2.5, text: "first" },
      { time: 3.5, text: "second" },
    ],
  );
});

test("parseLrc accepts enhanced-LRC word timestamps when available", () => {
  const [line] = parseLrc(
    "[00:10.00]<00:10.00>Hello,  <00:10.65>long-word!",
  );

  assert.equal(line.text, "Hello,  long-word!");
  assert.deepEqual(line.words, [
    { text: "Hello,", time: 10, endTime: 10.65 },
    { text: "long-word!", time: 10.65 },
  ]);
});

test("reveal progress is clamped to line boundaries and honors reduced motion", () => {
  const lines = parseLrc("[00:10.00]one two\n[00:14.00]three four");

  assert.equal(getLyricRevealProgress(lines, 0, 9), 0);
  assert.equal(getLyricRevealProgress(lines, 0, 10), 0);
  assert.equal(getLyricRevealProgress(lines, 0, 12), 0.5);
  assert.equal(getLyricRevealProgress(lines, 0, 14), 1);
  assert.equal(getLyricRevealProgress(lines, 0, 100), 1);
  assert.equal(getLyricRevealProgress(lines, 1, 10), 0);
  assert.equal(getLyricRevealProgress(lines, 1, 10, true), 1);
  assert.equal(getLyricRevealProgress(lines, -1, 10), 0);
});

test("the final line uses a bounded estimate instead of revealing forever", () => {
  const [line] = parseLrc("[00:20.00]one two three four five six seven eight nine ten");

  assert.equal(getLyricRevealProgress([line], 0, 20), 0);
  assert.ok(getLyricRevealProgress([line], 0, 21) > 0);
  assert.equal(getLyricRevealProgress([line], 0, 100), 1);
});

test("word tokenization preserves punctuation, long words, and whitespace", () => {
  assert.deepEqual(splitLyricText("  Hello,   supercalifragilistic!\n"), [
    { kind: "whitespace", text: "  " },
    { kind: "word", text: "Hello," },
    { kind: "whitespace", text: "   " },
    { kind: "word", text: "supercalifragilistic!" },
    { kind: "whitespace", text: "\n" },
  ]);
});

test("the rendered lyric line exposes accessible text and reveal hooks", async () => {
  const component = await readFile(
    resolve(root, "src/components/apple/SyncedLyrics.tsx"),
    "utf8",
  );
  const styles = await readFile(
    resolve(root, "src/components/apple/SyncedLyrics.css"),
    "utf8",
  );

  assert.match(component, /aria-label=\{line\.text\}/);
  assert.match(component, /className="apple-synced-lyrics__word"/);
  assert.match(component, /--lyric-progress/);
  assert.match(styles, /scrollbar-width:\s*none/);
  assert.match(styles, /\.apple-synced-lyrics__line\.is-upcoming/);
});
