Review the code changes in the current conversation with the critical eye of a senior engineer doing a PR review. Your goal is to find real problems — not validate the work.

Read the relevant files before forming an opinion. Cross-reference with the rest of the codebase for style and pattern consistency.

Cover these dimensions:

1. **CORRECTNESS**
   - Edge cases not handled (null, empty, zero, very large, concurrent)
   - Off-by-one errors, race conditions, async bugs
   - What happens when each external call fails?
   - Are there silent failures (e.g. `parseFloat('abc')` → NaN, `new Date('YYYY-MM-DD')` UTC shift)?

2. **RESPONSIVE / CROSS-PLATFORM**
   - Does this render correctly on mobile (≤480px) AND desktop (≥1024px)?
   - Touch targets ≥44px? Hover-only interactions also tappable?
   - Modals, dropdowns, overlays: are they cut off by the bottom nav, virtual keyboard, or device safe areas (`env(safe-area-inset-bottom)`)?
   - Use `dvh` (dynamic viewport height) instead of `vh` where the virtual keyboard shrinks the viewport
   - Is text readable without zoom? Are forms usable with mobile keyboards?
   - Tablet / in-between widths — anything broken at `sm:` or `md:` breakpoints?

3. **UX & ACCESSIBILITY**
   - Loading, empty, and error states all present?
   - Error messages: do they clear when the user starts correcting input, or do they linger confusingly?
   - Keyboard navigation, `Escape` to close modals, focus management on open/close
   - Backdrop click to dismiss modals
   - ARIA labels on icon-only buttons, screen reader experience
   - Color contrast (especially `text-slate-400` or similar light text)

4. **CODE QUALITY**
   - Naming clarity, duplication (copy-paste between similar components)
   - Type safety: `field: string` vs `field: keyof typeof form`, unsafe casts, missing return types
   - Are abstractions earning their weight? Premature? Missing?

5. **PERFORMANCE**
   - Unnecessary re-renders
   - N+1 queries or waterfall fetches
   - Anything slow at 10x current data volume?

6. **SECURITY**
   - Input validation — what reaches the API unvalidated?
   - Auth checks, data exposure
   - User-controlled values flowing into queries or HTML unsanitised

7. **TESTABILITY**
   - What's the first test you'd write?
   - What's NOT covered and why does that gap matter?

---

**Output format:**

Group findings by severity:
- 🔴 **Critical** — will cause bugs, data loss, or security issues in production
- 🟡 **Important** — degrades UX or maintainability meaningfully
- 🟢 **Nice to have** — worth fixing when convenient

For each finding: `file:line` · what's wrong · why it matters · concrete suggested fix (show the diff, not vague advice like "improve error handling").

End with: **Top 3 to fix in 30 minutes** — ranked by real-world impact.

After listing findings, ask me which ones to fix. Don't fix anything without confirmation.
