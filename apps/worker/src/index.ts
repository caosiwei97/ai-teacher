const PORT = Number(process.env.WORKER_PORT || 38422);

async function main() {
  console.log(`[worker] starting on port ${PORT}...`);
  console.log(`[worker] ready`);
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
