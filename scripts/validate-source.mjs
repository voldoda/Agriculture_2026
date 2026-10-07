// Validate the active 2025 dataset, not the retired 5–9 month sample.
process.argv.push('--check');
await import('./import-2025.mjs');
if (process.argv.includes('--require-ready')) process.exitCode = 2;
