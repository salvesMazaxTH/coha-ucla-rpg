# Quick Task 260416-jvq - Fix fist print orientation

## Goal

Prevent the punch silhouette (`punch_silouete.png`) from rotating based on attack direction.
Keep the texture upright as authored in the original PNG while still positioning it at the correct target location.

## Scope

1. Update fist print mesh setup in `public/js/animation/skillAnimations.js`.
2. Ensure no randomized/self-axis rotation is applied to the punch texture.
3. Keep current target positioning and timing behavior unchanged.

## Tasks

### Task 1

- files: `public/js/animation/skillAnimations.js`
- action: Remove directional rotation from `this.fistPrint` so it remains upright.
- verify: Inspect code path for `MeleePunchEffect` constructor and confirm fixed rotation value.
- done: `this.fistPrint.rotation.z` no longer depends on `angle`.

### Task 2

- files: `public/js/animation/skillAnimations.js`
- action: Add brief inline comment clarifying why fist print should stay unrotated.
- verify: Comment is concise and placed directly above rotation line.
- done: Future edits preserve intended visual orientation.

## Expected Output

- Punch silhouette appears at target impact position.
- Punch silhouette remains visually straight, matching source PNG orientation.
