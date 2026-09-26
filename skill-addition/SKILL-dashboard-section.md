# Coach skill changes for the dashboard

Merged into the hevy-weekly-coach skill on 2026-09-26. The full, current skill is in
`SKILL.full.md` next to this file; it is the reference for the week data file contract
(section "Week data file (for the dashboard)") and for where the weekly prescription
comes from (Run order, step 2).

Summary of what changed in the skill:

- New config `DATA_FOLDER = Allenamento/Report settimanali/dati`.
- Every weekly, halted and setup run writes `S{week:02d}.json` there; dry runs write nothing.
- The week's prescription is taken from last week's file (`next`), not from the Hevy
  routines, because Hevy can overwrite routine loads with the completed workout.
- Optional `kgPerSet` for per-set loads; `mode: "backfill"` for hand-reconstructed weeks.
- Dashboard-facing text (`phase`, `verdict`, `reason`) is in English; the emailed report
  stays in Italian.
