import sqlite from "sqlite3";
import { open } from "sqlite";

async function init() {
  const db = await open({
    filename: ":memory:",
    driver: sqlite.Database,
  });
  await db.migrate();
  return db;
}

export default await init();
