---
status: investigating
trigger: "serene-jeff-death-claim-stack-overflow — Stack overflow (hasBinary recursion) when Serene dies under Jeff death mark + semi-immortality ult hook"
created: 2026-04-16T00:00:00Z
updated: 2026-04-16T00:00:00Z
---

## Current Focus

<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: hasBinary recurses into circular reference in game state emitted via Socket.IO at death resolution moment — likely Serene or a status effect object holds a back-reference to a Champion or Match that creates a cycle
test: read Serene skills.js (ult/immortality hook), Jeff death claim VFX/logic, and Socket.IO emission points to find what object is emitted and whether it can contain cycles
expecting: a circular reference (e.g. statusEffect → champion → statusEffects → statusEffect) in the payload sent to socket.emit at the death moment
next_action: read Serene skills, Jeff death claim, and deathClaim VFX/logic

## Symptoms

<!-- Written during gathering, then IMMUTABLE -->

expected: Serene should die (same as ally in threshold/mark condition); Jeff ult should bypass Serene immortality in this interaction
actual: Turn appears to freeze around the moment Serene should die; may not transition turn
errors: RangeError: Maximum call stack size exceeded in node_modules/socket.io-parser/build/cjs/is-binary.js hasBinary recursion. Snapshot/log mentions Serene HP: 0, alive: false, deathClaimTriggered: true
reproduction: Serene uses ult (semi-immortality hook active), then receives Jeff ult death mark, then when trigger/tick/check condition is reached, issue occurs
started: This specific scenario is new and likely never happened before; Jeff is relatively recent

## Eliminated

<!-- APPEND only - prevents re-investigating -->

## Evidence

<!-- APPEND only - facts discovered -->

## Resolution

<!-- OVERWRITE as understanding evolves -->

root_cause:
fix:
verification:
files_changed: []
