import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { generateEmbedding } from "../config/gemini.js";
import {
  getIndex,
  getEmbeddingCount,
  storeEmbedding,
} from "../config/chromaDb.js";

interface DataRow {
  [key: string]: string;
}

async function ingestCsvFile(
  filePath: string,
  textColumn: string,
  idColumn: string
) {
  console.log(`\n📂 Processing: ${path.basename(filePath)}`);

  const index = await getIndex();
  const fileName = path.basename(filePath, ".csv");

  return new Promise((resolve, reject) => {
    const records: DataRow[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row: DataRow) => {
        records.push(row);
      })
      .on("end", async () => {
        console.log(`→ Total records: ${records.length}`);

        let processed = 0;
        for (let i = 0; i < records.length; i += 50) {
          const batch = records.slice(i, i + 50);

          for (const record of batch) {
            try {
              const id = `${fileName}_${record[idColumn]}`;
              const text = record[textColumn];
              const metadata = { source: fileName };

              const embedding = await generateEmbedding(text);

              // Use ChromaDB storeEmbedding function
              await storeEmbedding(id, embedding, { source: fileName }, text);

              processed++;
              if (processed % 50 === 0) {
                console.log(
                  `  → Ingested ${processed}/${records.length} records...`
                );
              }

              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (error) {
              console.error(`Failed to process record:`, error);
            }
          }
        }

        console.log(`✅ Completed: ${processed} records ingested`);
        resolve(processed);
      })
      .on("error", reject);
  });
}

export async function runIngestion() {
  console.log("🚀 Starting RAG Data Ingestion Pipeline");

  const dataDir = "./data";
  const files = [
    {
      path: path.join(dataDir, "PROcessed_nepal_seismicity.csv"),
      textColumn: "rag_input_text",
      idColumn: "id",
    },
    {
      path: path.join(dataDir, "History_processed_dataser2.csv"),
      textColumn: "rag_input_text",
      idColumn: "id",
    },
    {
      path: path.join(dataDir, "PROcessed_manual.csv"),
      textColumn: "rag_input_text",
      idColumn: "id",
    },
    {
      path: path.join(dataDir, "National_Emergency_Contacts.csv"),
      textColumn: "Agency / Organization",
      idColumn: "S.N.",
    },
  ];

  let totalIngested = 0;

  for (const file of files) {
    if (fs.existsSync(file.path)) {
      try {
        const count = (await ingestCsvFile(
          file.path,
          file.textColumn,
          file.idColumn
        )) as number;
        totalIngested += count;
      } catch (error) {
        console.error(`Failed to ingest ${file.path}:`, error);
      }
    } else {
      console.warn(`⚠️ File not found: ${file.path}`);
    }
  }

  const total = await getEmbeddingCount();

  console.log("\n" + "=".repeat(50));
  console.log("✅ Ingestion Complete!");
  console.log("=".repeat(50));
  console.log(`Total documents in database: ${total}`);
}
