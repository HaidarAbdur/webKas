# Refinement Plan: Fix main.js Class Naming and Add Partial Status CSS

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix CSS class naming mismatch in `static/main.js` and add `.payment-month.parsial` styles to `static/style.css` for weekly payment tracking.

**Architecture:** Frontend UI update aligning JavaScript dynamic classes with CSS styles (classes: `lunas`, `parsial`, `belum`).

**Tech Stack:** Vanilla JavaScript, CSS3.

---

### Task 1: Fix Class Naming in static/main.js

**Objective:** Change uppercase status class strings to lowercase and use standard `parsial` instead of `Cicil`.

**Files:**
- Modify: `static/main.js:141-152`

**Step 1: Code to update**
- Line 141: `let statusClass = 'belum';`
- Line 146: `statusClass = 'lunas';`
- Line 150: `statusClass = 'parsial';`
- Add semicolons on lines 147, 148, 151.

**Step 2: Verification**
Inspect rendered class in browser element inspector.

---

### Task 2: Add CSS Rules in static/style.css

**Objective:** Add styling for `.payment-month.parsial` and `.month-detail`.

**Files:**
- Modify: `static/style.css:675`

**Step 1: CSS to append**
```css
.payment-month.parsial {
    background: rgba(251, 191, 36, 0.08);
    border-color: var(--warning);
    color: var(--warning);
}

.payment-month .month-detail {
    font-size: 0.68rem;
    line-height: 1.2;
    margin-top: 0.25rem;
    opacity: 0.9;
}
```

**Step 2: Verification**
Verify color distinctions:
- Green (`.lunas`)
- Yellow/Orange (`.parsial`)
- Red (`.belum`)
