/\* ============================================
CSS ARCHITECTURE DOCUMENTATION
============================================

Your CSS has been reorganized into 4 semantic files,
categorized by ontological meaning and purpose.
Each file contains a specific domain of styling.

FILES OVERVIEW:

1.  base.css
    └─ Global resets and foundational styles
    └─ Universal selector resets (\*, html, body)
    └─ Global typography and utility classes
2.  layout.css
    └─ Page structure and positioning
    └─ Main containers (header, arena, team-container)
    └─ Layout relationships and spatial organization
    └─ Page-level visibility states
3.  ui.css
    └─ Reusable interface components
    └─ Buttons, controls, and interactive elements
    └─ Overlays and modal dialogs
    └─ Forms, bars, and visual containers
    └─ All responsive design rules for components
    └─ Detailed: skill buttons, HP bars, portraits,
    login screens, character selection,
    game over screens, combat logs, etc.
4.  animations.css
    └─ Combat effects and battle animations
    └─ Character status floats (damage, heal, buff, etc)
    └─ Entrance, exit, and transition animations
    └─ Dynamic visual feedback during gameplay
    └─ All @keyframes for battle effects
5.  vfx.css
    └─ Advanced visual effects using Canvas
    └─ VFX container structure
    └─ Fire stance canvas effects
    └─ Shield canvas rendering
    └─ Legacy commented effects for reference

============================================
LINKING ORDER IN HTML
============================================

1.  base.css (foundations first)
2.  layout.css (structure second)
3.  ui.css (components)
4.  animations.css (behaviors)
5.  vfx.css (advanced effects)

This cascading order ensures:

- Base resets apply first
- Layout builds on base
- UI components can override base/layout
- Animations layer on top
- VFX effects have highest specificity

============================================
ORGANIZATION BENEFITS
============================================

✓ Semantic Separation: Each file has a clear,
ontological purpose
✓ Maintainability: Find what you need quickly
✓ Scalability: Easy to add new components
✓ Performance: Can load critical CSS first
✓ Clarity: Commented organization within files
✓ Modularity: CSS files are independent units

============================================
\*/
