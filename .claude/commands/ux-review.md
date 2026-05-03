# UX Review

Review the entire UI/UX of this app from a product and user-experience perspective — not code quality. The goal is to suggest changes that make the product more user-friendly, more focused, and more beneficial for the user.

## Before you start

If the user hasn't already told you, ask:
1. Who is the primary user, and what is their main goal with this app?
2. What's the most important flow (the one that must be effortless)?
3. Are there screenshots or a screen recording I should look at? (UX reviews are much sharper with visuals — request them if not provided.)

If the user has already given this context in the conversation, skip the questions and proceed.

## Scope of review

Walk through the codebase to understand the screens, components, and user flows. Then evaluate against these dimensions:

### 1. User goals & focus
- For each screen, what is the user trying to accomplish?
- Does the UI make the next obvious action visually obvious?
- Flag screens that try to do too many things at once.
- What features could be removed or hidden to sharpen the core flow?

### 2. Information hierarchy
- Is the most important info biggest, first, or most prominent?
- Are secondary actions appropriately de-emphasized?
- Is anything fighting for attention that shouldn't be?

### 3. Friction points
- Count taps/clicks to complete the core flows.
- Flag anywhere the user types something the app could pre-fill, infer, remember, or default intelligently.
- Look for repeated actions that could be batched or automated.

### 4. Mobile UX
- Touch targets at least 44×44px
- Thumb reachability for primary actions
- Bottom-nav vs. modal/sheet conflicts (modals being clipped, buttons hidden behind nav)
- Keyboard handling (does the input stay visible when keyboard opens?)
- Safe area handling (notch, home indicator)
- Scroll behavior in long forms or lists

### 5. States
- Empty states: are they helpful and instructive, or just blank?
- Loading states: skeleton vs. spinner vs. nothing — appropriate choice?
- Error states: do they tell the user what to do, or just show "Error"?
- Success states: is feedback clear and proportionate?

### 6. Visual consistency
- Spacing, typography scale, color usage
- Component reuse vs. one-off variants
- Iconography consistency and clarity (any icons that need labels?)

### 7. Cognitive load
- Too many fields per screen?
- Jargon or developer-y labels that should be human language?
- Unexplained acronyms or abbreviations?
- Required vs. optional clarity?

### 8. Delight & retention
- What would make the user want to come back tomorrow?
- What's missing that a thoughtful product designer would add? (e.g., quick stats, streaks, useful summaries, smart defaults)
- Where could small touches make a big emotional difference?

### 9. Accessibility (basic pass)
- Color contrast for text
- Form labels and input associations
- Keyboard navigation on web
- Screen reader hints for icon-only buttons

## Output format

Group findings by priority:

### 🔴 P0 — Broken or confusing
Things that actively block or confuse users right now.

### 🟡 P1 — Significant improvements
Changes that would meaningfully improve the experience.

### 🟢 P2 — Polish
Refinements worth doing eventually.

For each finding, include:
- **Screen/component**: name + file path if known
- **Issue** (from the user's perspective, not the developer's)
- **Proposed change**
- **Expected impact** (e.g., "reduces taps to log a bill from 6 → 3", "removes the most common point of confusion in onboarding")

## Final summary

End with a **Top 5 changes I'd make this week** section. Pick the highest-impact, lowest-effort items from across all priorities. This is the part the user will actually act on — make it count.

## Tone

Be direct and specific. Avoid generic advice like "improve usability" or "make it more modern." Every suggestion should be concrete enough that a developer could implement it without asking follow-up questions.

If something is genuinely good, say so — don't manufacture problems. A 10-item sharp review beats a 40-item padded one.
