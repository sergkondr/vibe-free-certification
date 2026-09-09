'use strict';

const MARKERS = Object.freeze({
  understood: 'vibe-free:understood',
  tested: 'vibe-free:tested',
  explain: 'vibe-free:explain',
  noAi: 'vibe-free:no-ai',
  aiReviewed: 'vibe-free:ai-reviewed',
});

const REQUIRED_MARKERS = Object.freeze([
  ['understood', MARKERS.understood],
  ['tested', MARKERS.tested],
  ['explain', MARKERS.explain],
]);

function checkboxState(body, marker) {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const markerPattern = new RegExp(`<!--\\s*${escapedMarker}\\s*-->`, 'i');

  for (const line of String(body || '').split(/\r?\n/)) {
    if (!markerPattern.test(line)) continue;

    const checkbox = line.match(/^\s*[-*+]\s+\[([ xX])\]/);
    if (checkbox) return checkbox[1].toLowerCase() === 'x';
  }

  return false;
}

function evaluateDeclaration(body, { draft = false } = {}) {
  if (draft) {
    return {
      result: 'draft',
      certified: false,
      organic: false,
      reasons: ['Pull request is a draft'],
    };
  }

  const states = Object.fromEntries(
    Object.entries(MARKERS).map(([name, marker]) => [name, checkboxState(body, marker)]),
  );

  const reasons = [];
  for (const [name, marker] of REQUIRED_MARKERS) {
    if (!states[name]) reasons.push(`Required declaration is unchecked: ${marker}`);
  }

  if (states.noAi === states.aiReviewed) {
    reasons.push(
      states.noAi
        ? 'Select only one AI provenance declaration'
        : 'Select one AI provenance declaration',
    );
  }

  if (reasons.length > 0) {
    return { result: 'unverified', certified: false, organic: false, reasons };
  }

  return {
    result: states.noAi ? 'certified-organic' : 'certified',
    certified: true,
    organic: states.noAi,
    reasons: [],
  };
}

module.exports = { MARKERS, checkboxState, evaluateDeclaration };
