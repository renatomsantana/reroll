# MASTER PROMPT: Parametric Fantasy Dice Tower Generator (FDM-Ready)

You are a parametric CAD generation agent. Produce a fully parametric, 3D-printable model set for a medieval fantasy dice tower system, delivered in two variants that share a common internal mechanism. Follow every specification below exactly. Do not ask clarifying questions; where a choice is open, use the stated default and expose it as a parameter. Treat every numeric value in this document as a named, editable parameter with the given default and range, not a hardcoded constant.

## 0. Reference Analysis (ground truth for both variants)

**Reference A, "Classic Castle Tower":** a matte-finish cylindrical castle turret with square crenellations (merlons) around the top rim, exterior wrapped in offset running-bond stone brick coursing. Dice are dropped through a circular opening in the top lid and fall through an internal baffle system, visible as a stepped/spiral funnel just below the opening. A separate round honeycomb organizer tray sits beside the tower: one center hexagonal cell surrounded by six more, holding one complete 7-piece RPG dice set with no die touching another. A wide circular/semicircular rolling tray with a raised rim sits under the tower's exit, large enough to catch and display multiple full dice sets after they land. A companion medallion-style disc shows a debossed star/D20 motif with numerals, used as a decorative base or lid inlay.

**Reference B, "Arcane Spiral Tower":** the same crenellated brick cylinder, but slimmer and taller, with an external helical staircase wrapping the tower's exterior roughly 1.25 to 1.5 turns from a crenellated base ring up to a crenellated cap. The staircase reads as a continuous solid ribbon (stringer + treads as one printed helix), not floating steps, with a thin balustrade along the outer edge. The base ring forms a shallow crenellated catch-tray identical in function to Reference A's rolling tray. This variant is the basis for the "wizard tower" flavor: gothic windows, stone arches, and rune engravings are added on top of this shell.

Both variants must use the **same internal drop/ramp module, the same lid-to-tower fit system, and the same organizer/tray modules**. Only the exterior shell (Reference A vs Reference B) differs.

## 1. Core Print-Ready Strategy (read this before generating geometry)

Two well-known FDM failure points drive the entire structural approach. Solve them at the geometry level, not with slicer supports:

1. **Internal ramps are horizontal-ish shelves cantilevered off a vertical wall.** Printed inside an intact cylinder, they need support underneath. Solve this by splitting the main tower body into **two mating vertical half-shells** (split along a diametral plane through the cylinder's axis). Each half is printed lying on its flat split face, so every ramp becomes a shelf rising directly off a bed-parallel wall, self-supporting via 45-degree fillets at the wall junction. The two halves join with a tongue-and-groove seam hidden inside a mortar groove line, secured with alignment pins (and optionally magnets or glue).
2. **The external spiral staircase (Reference B) is a continuous helical ribbon**, not floating treads. This is self-supporting in FDM as long as the helix pitch angle stays at or below 45 degrees measured at the tread's outer edge relative to the material printed one layer below in the previous winding. Target a pitch angle of 30 to 40 degrees for margin. Print the tower vertically (cylinder axis = Z) for this feature; the two-half split from point 1 still applies to the tower body underneath, the staircase is modeled as a separate shell wrapping the outside seam so the split line stays hidden behind a step.

State both strategies explicitly in the generated design notes so a human reviewer can verify them before printing.

## 2. Deliverables

1. `castle_tower_body.stl` (or two files if split: `_half_a`, `_half_b`)
2. `castle_tower_lid.stl`
3. `castle_rolling_tray.stl`
4. `dice_organizer_tray.stl` (repeatable/stackable, export as one part, parametrize count)
5. `wizard_tower_body.stl` (split halves as needed) + `wizard_staircase_shell.stl` if modeled separately
6. `wizard_tower_lid.stl` (doubles as the observation platform floor, see Section 8)
7. One native parametric source file per variant (whatever your CAD engine natively uses: script, feature tree, or equivalent) with every parameter in Section 10 exposed at the top, plus a generated parameter reference sheet (name, default, range, description, one line each).
8. One assembled preview (STEP or 3MF, or a rendered PNG turntable if that is all your pipeline supports) per variant, for visual QA before slicing.

## 3. Global Parameters

| Parameter | Default | Range | Notes |
|---|---|---|---|
| unit | mm | fixed | all values in this document are mm |
| overall_scale | 1.0 | 0.9-1.3 | global multiplier, use 1.15-1.3 for oversized resin dice sets |
| wall_thickness | 2.8 | 2.5-3.0 | |
| floor_thickness | 3.2 | 3.0-4.0 | |
| min_feature_size | 0.8 | fixed floor | nothing thinner than this anywhere |
| fit_clearance_per_side | 0.18 | 0.15-0.25 | FDM friction-fit tolerance, apply to every mating pair |
| fillet_interior_general | 2.0 | 1.5-3.0 | all internal transitions |
| fillet_dice_contact | 3.0 | 2.5-4.0 | anywhere a die can strike or slide, higher priority than general fillet |
| chamfer_internal_edge | 0.8 mm x 45 deg | fixed | applied to all sharp internal edges not otherwise filleted |
| fillet_exterior_corner | 1.2 | 1.0-1.5 | |

## 4. Dice Reference Geometry (drives every cavity, recess, and clearance check)

Use these as the default "16 mm set" sizing. Every cavity dimension elsewhere in this document derives from this table, do not hardcode cavity numbers separately from it.

| Die | Nominal width across flats | Approx. max span (vertex to vertex) | Approx. height |
|---|---|---|---|
| D4 | 16 | 18 | 14 (apex height) |
| D6 | 16 | 22 | 16 |
| D8 | 16 | 20 | 18 |
| D10 | 16 | 19 | 17 |
| D% (percentile D10) | 16 | 19 | 17 |
| D12 | 18 | 22 | 19 |
| D20 | 20 | 24 | 21 |

`max_die_span` (used for clearance checks) = the largest "max span" value across the active set x `overall_scale`, default 24 mm.

## 5. Module: Main Tower Body (shared shell logic, exterior differs per variant)

- `tower_outer_diameter`: 90 (range 80-110), 75 (range 70-85) for the Wizard variant, since it reads slimmer and taller
- `tower_inner_diameter` = `tower_outer_diameter` - 2 x `wall_thickness` (computed, not manually set)
- `tower_body_height`: 180 (range 150-220) for Castle, 260 (range 220-320) for Wizard
- `crenellation_count`: 8 (range 6-10), `merlon_width`: 12, `merlon_height`: 10, `merlon_gap_width`: 10, applied at both the tower's top rim and, for the Wizard variant, the base ring and cap ring
- If `tower_body_height` + lid height exceeds the target printer's Z build volume (expose `printer_max_z`, default 250), auto-split the body into two stacked segments joined by an interlocking coupler ring, and position the seam at a natural brick-course line so it visually disappears
- Vertical half-shell split (Section 1, point 1) is mandatory for both variants regardless of height splitting; the two concerns are independent (one splits along the axis for support-free ramps, the other splits perpendicular to the axis for build volume)

## 6. Module: Internal Ramp / Baffle System (identical for both variants)

- `ramp_count`: 5 (range 4-6)
- `ramp_vertical_spacing` = usable interior height / (`ramp_count` + 1), computed
- `ramp_length_fraction`: 0.75 (range 0.70-0.80) of `tower_inner_diameter`
- `ramp_thickness`: 3.0
- `ramp_slope_angle`: 15 degrees from horizontal (range 12-18)
- `ramp_profile`: gently concave (slide-shaped), not a flat plate. This is deliberate: a concave chute lets dice tumble off the end with less required straight-line clearance than a flat shelf would need, while still meeting the clearance rule below
- `ramp_rotational_offset`: 50 degrees (range 45-60) applied between each successive ramp, alternating clockwise/counter-clockwise, in addition to alternating which wall each ramp is attached to. This produces the chaotic, non-repeating bounce path the brief calls for
- Every ramp edge gets `fillet_dice_contact` (3.0 mm default)
- **Clearance validation (must pass for every ramp, adjust `tower_inner_diameter` or `ramp_length_fraction` until it does):**
  - Horizontal gap beside each ramp >= 1.3 x largest active die's nominal width (not full vertex-to-vertex span, since dice tumble through rather than needing to clear at their widest orientation)
  - Vertical drop between successive ramps >= 1.5 x largest active die's height
  - Report the computed gap and drop values for the chosen defaults in the design notes, and flag if either falls short so a human can widen the tower

## 7. Module: Top Lid (shared design, per-variant crenellation to match its tower)

- `lid_outer_diameter` = `tower_outer_diameter` + 2 x `fit_clearance_per_side` (computed)
- `lid_skirt_depth` (internal lip that slides into the tower for alignment): 15 (range 12-18)
- Crenellation pattern continues the tower's `merlon_width`/`merlon_gap_width` so the seam is invisible when seated
- `center_drop_hole_diameter`: 45 (range 35-50), must exceed `max_die_span` with margin
- Optional recessed die-storage slots on the lid top face, one per die type, each a shallow silhouette cavity: depth = die height x 0.6, footprint = die's nominal width/span + 1.5 mm clearance per side, toggle `enable_lid_die_slots`
- `enable_magnets` toggle: if true, add `magnet_pocket_count` (default 3, evenly spaced) pockets of `magnet_diameter` + 0.15 mm x `magnet_depth` (2.0), default magnet 6 mm diameter x 2 mm
- If magnets are disabled, rely on a 3-lug bayonet twist-lock (120 degrees apart, lug depth 2.5, rotate-and-catch geometry) as the retention method, expose `retention_method` = "magnet" | "bayonet" | "friction_only"

## 8. Module: Wizard Variant Exterior Additions

- `staircase_turns`: 1.35 (range 1.0-1.5)
- `staircase_step_count`: 16 (range 12-20)
- `step_rise` = `tower_body_height` / `staircase_step_count` (computed)
- `step_run` (tread depth): 18, `step_width`: 14
- `railing_height`: 10, `baluster_spacing`: 12, baluster diameter 2.5
- Central connection: staircase attaches to the tower wall via 3 short structural struts (not floating away from the tower), `strut_width`: 8, spaced evenly along the helix
- Helix pitch angle (see Section 1, point 2) must be computed and checked <= 45 degrees, target 30-40; report the computed value
- Observation platform at top doubles as the lid: `platform_ring_width`: 10 beyond `tower_outer_diameter`, crenellated to match, with the same `center_drop_hole_diameter` opening so dice still drop through the same mechanism; the staircase visually leads up to this platform (thematic detail, does not change function)
- Gothic windows: `window_count`: 5 (range 4-6), pointed-arch (ogive) silhouette, `window_height`: 25, `window_width`: 10, blind relief by default (`window_through_wall` toggle, false by default to preserve structural strength and print-ability); if set true, model the arch top as a self-supporting corbelled arch (each brick course stepping inward, matching real masonry construction) so no support material is needed
- Blind stone arch relief band at the base: height 15, relief depth 1.0
- Rune engravings: `enable_runes` toggle, channel depth 0.8, channel width 2.0, path/placement driven by an importable custom symbol parameter (`rune_svg_path`), default placement as a band within one brick course near the base

## 9. Module: Dice Organizer (honeycomb tray)

- `tray_outer_diameter` = `tower_outer_diameter` (so it stacks flush with the tower footprint)
- 7 cells: 1 center + 6 surrounding, each cell sized to its die type from Section 4 plus 2 mm clearance on every side, `cell_wall_thickness`: 2.0, `cell_depth` = tallest active die height + 2 mm
- Stacking lip: 2 mm tall x 1.5 mm deep interlocking rim so multiple trays (`organizer_tray_count`, default 1, range 1-4) nest without sliding
- All cell floor corners get `fillet_interior_general`

## 10. Module: Bottom Rolling Tray

- `tray_extension_radius` = `tower_outer_diameter`/2 + 70 (range +50 to +90)
- `tray_wall_height`: 12, `tray_floor_thickness`: `floor_thickness`
- Exit chute width matches `tower_inner_diameter` exactly where it meets the tower base, filleted transition (`fillet_interior_general`)
- Optional engraved emblem socket at the tray's rear center: diameter 40, depth 1.0, `emblem_motif` selectable ("dragon" | "compass_rose" | "d20_star" | "none"), modeled as a debossed relief or as a separate press-fit insert disc, expose `emblem_as_insert` toggle

## 11. Assembly, Fit, and Tolerances

- Every mating pair (lid/tower, tower/tray, organizer stack, half-shell seam) uses `fit_clearance_per_side` consistently, do not invent separate tolerances per joint
- Half-shell seam: tongue 2.0 mm wide x 1.5 mm deep, groove matches + `fit_clearance_per_side`, routed along a mortar groove so it reads as a design line, not a defect
- Alignment pins between tray and tower base: 2 diameter x 4 long, chamfered tip, 2 pins at 180 degrees apart, blind holes with standard clearance
- Document expected friction-fit force qualitatively (snug hand-fit, not tool-required) in the design notes

## 12. Print Orientation and Support-Free Verification

- Recommended orientation: cylinder axis vertical (Z-up), each half-shell printed on its flat split face for the tower body
- Explicitly confirm, per module, that no face exceeds a 45-degree unsupported overhang except where covered by the corbelled-arch technique (Section 8) or the split-seam design (Section 1)
- If `tower_body_height` requires a horizontal split for build volume (Section 5), position that seam at a brick-course boundary
- State nozzle/layer assumptions used for feature sizing: 0.4 mm nozzle, 0.2 mm layer height, confirm `min_feature_size` (0.8 mm) is achievable at this resolution

## 13. Brick and Stone Texture

- `brick_course_height`: 8 (range 7-9)
- `brick_length_avg`: 18, randomized per-brick in range 14-22 (seeded, deterministic per `texture_seed` parameter so results are reproducible)
- `mortar_groove_depth`: 0.6, `mortar_groove_width`: 1.0
- Running-bond offset: 50% stagger between alternating courses
- Wrap the pattern using an angle-based (not linear-then-cut) tiling function so the seam at 0/360 degrees is invisible, verify by checking the last brick in each course closes cleanly against the first
- Continue the identical texture function across the lid's crenellated skirt and, for the Wizard variant, across the staircase's outer stringer face

## 14. All Exposed Parameters (must appear in a single top-level parameter block, no magic numbers elsewhere in the geometry code)

overall_scale, wall_thickness, floor_thickness, fit_clearance_per_side, fillet_interior_general, fillet_dice_contact, chamfer_internal_edge, fillet_exterior_corner, tower_outer_diameter, tower_body_height, crenellation_count, merlon_width, merlon_height, merlon_gap_width, printer_max_z, ramp_count, ramp_length_fraction, ramp_thickness, ramp_slope_angle, ramp_rotational_offset, lid_skirt_depth, center_drop_hole_diameter, enable_lid_die_slots, enable_magnets, magnet_pocket_count, magnet_diameter, magnet_depth, retention_method, staircase_turns, staircase_step_count, step_run, step_width, railing_height, baluster_spacing, window_count, window_height, window_width, window_through_wall, enable_runes, rune_svg_path, tray_outer_diameter, organizer_tray_count, tray_extension_radius, tray_wall_height, emblem_motif, emblem_as_insert, brick_course_height, brick_length_avg, texture_seed, entry_drop_height, final_ramp_angle, min_bounce_count, ramp_surface_ridge_height, metal_dice_mode

## 15. Dice Throw Physics and Randomization Requirements

The ramp system (Section 6) is a mechanism, not just a decorative funnel. It has to actually produce fair, energetic, well-controlled dice throws. Treat the following as functional requirements, not flavor text.

### Energy Flow Overview
- `entry_drop_height`: 35 (range 25-50), the free-fall gap between the lid's `center_drop_hole_diameter` opening and the first ramp. This builds enough initial kinetic energy to force real tumbling instead of a die just sliding down under low speed.
- `ramp_slope_angle` (Section 6, 12-18 degrees) governs how much speed each ramp restores between bounces. Steeper angles near 18 keep dice moving fast through a shorter tower, gentler angles near 12 bleed more energy per bounce.
- `final_ramp_angle`: 8 (range 6-10), a new parameter that applies only to the last (lowest) ramp. It must be shallower than the general `ramp_slope_angle`. Its job is to act as a brake, soaking up excess velocity right before the exit chute, so dice do not shoot out of the tower too fast and bounce out of the rolling tray.

### Randomization Mechanics
- Every die must experience at least `min_bounce_count` distinct ramp contacts (default 3, range 3-5) between entry and exit. Check this against `ramp_count` and the vertical spacing computed in Section 6, a straight unobstructed drop-through path is a design failure, not an acceptable fast path.
- `ramp_rotational_offset` (45-60 degrees, alternating direction, Section 6) exists specifically to prevent geometrically biased outcomes. Without it, a given die shape (a tetrahedral D4 behaves very differently from an icosahedral D20) can find a repeatable "preferred lane" through symmetric baffles, which is a fairness problem, not merely a wear problem.
- Add subtle surface texture to the ramp treads: `ramp_surface_ridge_height` 0.4 (range 0.3-0.6), a series of low transverse ridges. This nudges a tumbling die off a pure glide and forces extra rotation, while staying well under `fillet_dice_contact` so it never catches a corner and stalls a die mid-ramp.

### Exit Speed and Landing Control
- Tune `final_ramp_angle` together with `tray_wall_height` (Section 10, default 12): exit velocity should stay low enough that a die landing near the rolling tray's outer rim does not bounce over it. Since exact velocity depends on print material and die weight, treat `tray_wall_height` as the adjustable safety margin, and size it toward 15 for setups expected to see metal dice.

### Material and Weight Considerations
- `metal_dice_mode` toggle (default false): when true, increase `fillet_dice_contact` by about 1 mm and shift `final_ramp_angle` toward the low end of its range. Metal dice carry several times the momentum of standard plastic or resin dice, so they wear sharp internal edges faster and exit with more force.
- Standard plastic and resin dice sets need no adjustment beyond the Section 4 defaults.

### Physics Notes Required in the Design Report
Alongside the clearance validation from Section 6, report for each variant:
- the `entry_drop_height` used and the resulting initial fall
- the number of forced ramp contacts along the path (must be >= `min_bounce_count`)
- a qualitative exit velocity assessment (low, medium, high) based on `final_ramp_angle` and total ramp count
- confirmation that `tray_wall_height` and `tray_extension_radius` are sized to catch that exit velocity without dice bouncing out

## 16. One-Shot Acceptance Checklist (verify before returning final files)

1. All meshes are manifold and watertight, no self-intersections
2. No unsupported overhang exceeds 45 degrees, except where explicitly justified by the split-seam or corbelled-arch technique
3. Wall thickness nowhere below `wall_thickness` minimum, floor nowhere below `floor_thickness` minimum
4. Every dice-contact surface carries `fillet_dice_contact`, not just the general fillet
5. Section 6's clearance validation passes (or is reported as failing with a suggested parameter fix)
6. Lid, tray, and organizer test-fit within `fit_clearance_per_side` on every mating pair
7. Brick/stone texture wraps with no visible seam at 0/360 degrees
8. Castle and Wizard variants reuse the identical ramp module and organizer/tray module, only the exterior shell logic differs
9. Every value in Section 14 is a live parameter, changing one and regenerating does not require touching geometry code elsewhere
10. Output includes the parameter reference sheet and both design-note reports (clearance validation numbers, helix pitch angle for the Wizard variant)
11. Design report documents the physics trace from Section 15: entry drop height, forced bounce count (must be >= `min_bounce_count`), and exit velocity assessment
12. `final_ramp_angle` is confirmed shallower than the general `ramp_slope_angle`, and `tray_wall_height` / `tray_extension_radius` are sized for the resulting exit speed
