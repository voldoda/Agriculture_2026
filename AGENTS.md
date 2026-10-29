# Repository updates

- The user designated `WeSmart-co-op/Agriculture` as the primary source and `voldoda/Agriculture_2026` as its synchronized repository.
- For GitHub updates requested by the user, update **both** repositories. Do not silently publish only one.
- Fetch and inspect both current `main` heads before publishing. Resolve source conflicts using the primary repository, preserving agreed documents and improvements. Preserve both histories and existing tags; do not force push.
- Read `docs/REPOSITORY_SYNC.md`. `origin` fetches from the primary and has two push URLs, primary first. Use `npm run publish:repos` to check both repositories before publishing and verify their refs afterward.
- If either repository rejects an update, report the partial result and reconcile the difference; do not claim synchronization until both heads match.
- Keep credentials, `.env`, original private inputs and local temporary outputs excluded. Preserve existing source precision and data provenance.
