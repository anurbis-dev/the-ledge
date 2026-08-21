# Changelog (unreleased)

- Fall foam/spray at column tip: impact when **any** tile below (water/solid/slope…); empty below = no bottom foam (`fallTipKind` `hit` vs `air`).
- Fall hanging tip: strands + fill taper edges→center over last N tiles (`taper`/`taperLen`); edge strands → dots → gone, center stays lines longer.
- Fall Details: **Taper** (0–100, def 60) / **Taper Len** (1–8, def 3) → `tileGfx[14]`; getters `getTileTaper` / `getTileTaperLen`; helpers `fallColumnTip` / `fallTipKind`.
