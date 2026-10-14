/**
 * Minimal bidirectional text ordering for PDF output.
 *
 * fontkit shapes Arabic correctly but lays an entire string out as ONE run and
 * reverses all of it when the first strong character is Arabic — digits and
 * Latin words inside an Arabic sentence would come out mirrored, and brackets
 * are not mirrored. This module splits a line into runs of a single direction,
 * orders them for display (left to right on the page), and mirrors brackets, so
 * each returned segment can be drawn with one plain text() call.
 */

export type BaseDirection = 'rtl' | 'ltr';

const ARABIC_LETTER = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const DIGIT = /[0-9٠-٩۰-۹]/;
const LATIN = /[A-Za-zÀ-ɏ]/;
const NUMBER_JOINERS = '+-,.:/';
const MIRROR: Record<string, string> = {
  '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', '«': '»', '»': '«',
};

/** True when the text contains at least one right-to-left letter. */
export function hasRtlLetters(text: string): boolean {
  for (const ch of text) if (!DIGIT.test(ch) && ARABIC_LETTER.test(ch)) return true;
  return false;
}

function mirror(text: string): string {
  let out = '';
  for (const ch of text) out += MIRROR[ch] ?? ch;
  return out;
}

/**
 * Split `text` (one logical line) into segments in the order they must be drawn
 * from left to right. Segments that contain Arabic letters are returned in
 * logical order (fontkit reverses them); every other segment is ready to draw.
 */
export function visualSegments(text: string, base: BaseDirection): string[] {
  if (!text) return [];
  if (!hasRtlLetters(text)) return [text];

  const chars = Array.from(text);
  const n = chars.length;
  const isDigit = chars.map((c) => DIGIT.test(c));
  // true = right-to-left, false = left-to-right, null = neutral (resolved below)
  const dir: (boolean | null)[] = chars.map((c, i) => {
    if (isDigit[i] || LATIN.test(c)) return false;
    if (ARABIC_LETTER.test(c)) return true;
    return null;
  });
  // "1,234.50", "10-05", "13:20": a joiner between two digits belongs to the number.
  for (let i = 1; i < n - 1; i += 1) {
    if (dir[i] === null && NUMBER_JOINERS.includes(chars[i]) && isDigit[i - 1] && isDigit[i + 1]) {
      dir[i] = false;
      isDigit[i] = true;
    }
  }

  const baseIsRtl = base === 'rtl';
  // Direction a character exerts on neighbouring neutrals: digits take the
  // direction of the last strong letter before them (UBA rule W7).
  const context: (boolean | null)[] = new Array(n).fill(null);
  let lastStrong = baseIsRtl;
  for (let i = 0; i < n; i += 1) {
    if (isDigit[i]) context[i] = lastStrong;
    else if (dir[i] !== null) { lastStrong = dir[i] as boolean; context[i] = lastStrong; }
  }

  const resolved: boolean[] = new Array(n);
  let i = 0;
  while (i < n) {
    if (dir[i] !== null) { resolved[i] = dir[i] as boolean; i += 1; continue; }
    let j = i;
    while (j < n && dir[j] === null) j += 1;
    const before = i === 0 ? baseIsRtl : (context[i - 1] as boolean);
    const after = j === n ? baseIsRtl : (context[j] as boolean);
    const value = before === after ? before : baseIsRtl;
    for (let k = i; k < j; k += 1) resolved[k] = value;
    i = j;
  }

  const runs: { rtl: boolean; text: string }[] = [];
  for (let k = 0; k < n; k += 1) {
    const last = runs[runs.length - 1];
    if (last && last.rtl === resolved[k]) last.text += chars[k];
    else runs.push({ rtl: resolved[k], text: chars[k] });
  }
  if (baseIsRtl) runs.reverse();

  return runs.map((run) => {
    if (!run.rtl) return run.text;
    const mirrored = mirror(run.text);
    // A run without Arabic letters is not reversed by fontkit: do it here.
    return hasRtlLetters(mirrored) ? mirrored : Array.from(mirrored).reverse().join('');
  });
}
