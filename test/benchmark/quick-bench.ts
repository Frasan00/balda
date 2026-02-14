import { Type } from "@sinclair/typebox";
import { Server } from "../../src/server/server.js";
import { formatResult, runBenchmark, STANDARD_CONFIG } from "./runner.js";

const PORT = 3000;

const quickBench = async (): Promise<void> => {
  console.log("🚀 Quick Benchmark - Baseline Performance Test");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(
    `Configuration: -c ${STANDARD_CONFIG.connections} -d ${STANDARD_CONFIG.duration} -p ${STANDARD_CONFIG.pipelining}\n`,
  );

  const server = new Server({
    port: PORT,
    swagger: false,
    host: "0.0.0.0",
  });

  server.router.get(
    "/",
    {
      swagger: {
        responses: {
          200: Type.Object({
            message: Type.String(),
          }),
        },
      },
    },
    async (_req, res) => {
      res.json({ message: "Hello, world!" });
    },
  );

  try {
    await new Promise<void>((resolve) => {
      server.listen(() => {
        console.log(`✓ Server started on port ${PORT}\n`);
        resolve();
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("📊 Running benchmark...\n");
    const result = await runBenchmark(
      `http://localhost:${PORT}/`,
      "quick-baseline",
      STANDARD_CONFIG,
    );

    console.log(formatResult(result));
  } catch (err) {
    console.error("Benchmark failed:", err);
    throw err;
  } finally {
    console.log("\n🛑 Shutting down server...");
    await server.close();
    console.log("✓ Server closed");
  }

  console.log("\n✨ Quick benchmark completed!\n");
};

if (import.meta.url === `file://${process.argv[1]}`) {
  quickBench()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Benchmark failed:", err);
      process.exit(1);
    });
}
