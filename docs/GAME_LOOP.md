# Game Loop

Exploration leads to planning. Players select an actor and submit commands. Movement and attacks are queued as pending plans; they do not mutate canonical state during preview. The commit command freezes those plans, validates them against the authoritative snapshot, resolves ordered events, and pauses at any reaction window. Presentation output is derived from those events.

The demo exposes movement, interaction, attack, and phase commit. It is intentionally a narrow vertical slice rather than a complete combat ruleset.