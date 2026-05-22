import { describe, expect, test } from "bun:test";
import { stat } from "node:fs/promises";
import packageJson from "../../package.json";

const EXECUTABLE_MODE_MASK = 0o111;

describe("package shape", () => {
  test("exposes an executable watchtower bin for linked installs", async () => {
    expect(packageJson.bin).toEqual({ watchtower: "./index.ts" });

    const binStat = await stat(new URL("../../index.ts", import.meta.url));
    expect(binStat.mode & EXECUTABLE_MODE_MASK).not.toBe(0);
  });
});
