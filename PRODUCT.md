# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS in `web/`, served by FastAPI (`app/`), with no build step (inferred: recommended option, no answer received to the question). Knowledge-graph backend: GraphDB 11 in Docker (`127.0.0.1:7201`, repository `triage-es`), with an in-memory rdflib fallback.

## Users

- **Primary (confirmed by the owner, 22 November 2026):** the lecturer and students of the Advanced Expert Systems course (Sistem Pakar Lanjut), MIK UGM, who watch the final project in a class presentation on a projector. The app also serves as course material on knowledge representation and reasoning.
- **Demo persona:** an ER triage nurse who enters patient data through a conversation and receives an ESI level recommendation.

## Product Purpose

A chatbot for emergency-department triage whose backend is an expert system. Its knowledge is an OWL ontology plus a knowledge graph built from the ESI v4 rules (Gilboy 2012), and it reasons by forward chaining SPARQL rules. Success: the audience can follow how each conclusion is derived, from fact to rule to triple to ESI level, and every step traces back to its source.

## Positioning

Unlike a black-box LLM chatbot, every conclusion comes from rules that can be inspected: the IF-THEN, the SPARQL text, the triples added per cycle, and the literature source. The LLM (Claude) only extracts facts from free text and narrates the explanation; it never decides the ESI level.

## Operating Context

- Live demo in class: projector, viewing distance of several metres, the presenter speaking while operating the app.
- Explanatory material: the presenter opens reasoning details step by step (layered).
- Runs locally from the README; GraphDB is optional, and without the Claude API the app falls back to local mode.

## Capabilities and Constraints

- Fifteen rules (A01-A03, B01-B05, C01-C02, D01, E01, F01, G01, Z01), the agenda and questions are read from the knowledge graph.
- The question dialog follows ESI Decision Points A-D; questions are skipped when the algorithm has already concluded.
- Data: MC-MED aggregate statistics only; no patient-level data may be shown or bundled.
- The UI is in Indonesian.

## Evidence on Hand

- Gilboy et al. 2012 handbook (local at `Thesis Preparation/01 - Naskah Proposal/...`).
- MC-MED aggregates in `kb/evidence.ttl`.
- No clinical validation by an expert yet; do not claim the system is clinically validated.

## Product Principles

1. Every conclusion must be explainable down to the triple and its source.
2. The expert system decides; the LLM only assists at the edges.
3. Layered: a short summary for the demo, full detail when opened for teaching.
4. It must read well from the back row of the classroom.

## Accessibility & Inclusion

Large type and high contrast for the projector; full keyboard operation; ESI colours are always paired with a number and text label (never colour alone).
