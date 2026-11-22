---
version: 1
slug: "web-index-html"
primary_target: "web/index.html"
related_targets: []
---

Scope: web/index.html (the only surface). Mode: Operate (demo chatbot) with Read (lecture material).
Audience: lecturer and students on a classroom projector; demo persona is a triage nurse. Task: enter patient data through the conversation and watch the expert system reach an ESI level with layered explanations.
Constraints: UI text in Indonesian; ESI colour always paired with a number and label; aggregate data only; no claim of clinical validation.
Assumptions (no answer from the user on 22 Nov 2026): class presentation is primary, static HTML stack, layered reasoning detail. The decision page was skipped; the direction comes from the seed assignment.

## Direction contract

THESIS: The app is a printed ER triage sheet that fills itself in from the conversation, with an annotation margin holding a reasoning ledger that can be opened layer by layer. It refuses the category arrangement of "chat bubbles + dashboard cards".

OWN-WORLD: White form paper (#fdfdfc), black print ink for labels, carbon blue (#1d3c8f) for values the nurse enters, one rubric red (#b4231a) for the ESI stamp and warnings. 1 px blue-grey hairline rules on every field box, no shadowed cards, square corners. Standard ESI colours (1 red, 2 orange, 3 yellow, 4 green, 5 blue) appear only on the stamp and the algorithm strip. Type: Public Sans (a government-form face), tabular numerals; JetBrains Mono only for SPARQL and triples.

STORY: The audience sees the sheet fields fill in as the nurse replies, the A-B-C-D algorithm strip light up, the ESI stamp land, then the presenter opens one rule: IF-THEN, the facts used, the source, then the SPARQL and the triples it added, and replays the forward-chaining cycles.

FIRST VIEWPORT: Left 36%: the triage interview (questions as printed numbered lines, answers in carbon blue, reply input at the bottom, quick-answer chips). Right 64%: sheet header (title, backend status GraphDB/Claude), a grid of form fields, ESI stamp at top right, the A→D algorithm strip, then the reasoning ledger. Tabs: Lembar · Siklus inferensi · Basis pengetahuan. "Mode kuliah" toggle in the header.

FORM: Triage record sheet (form candidate 4 of 7); seed be81d5ff. Raises: centre-rail reference-setting (1 px ruling discipline, states as printed marks, a single accent); japanese-high-density-web (dense modules on the knowledge-base tab).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
