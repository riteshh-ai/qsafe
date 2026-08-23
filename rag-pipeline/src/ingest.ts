import { runIngestion } from "./services/ingestionService.js";

async function main() {
  try {
    await runIngestion();
    process.exit(0);
  } catch (error) {
    console.error("Ingestion failed:", error);
    process.exit(1);
  }
}

main();
