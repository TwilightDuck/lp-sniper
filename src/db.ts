import sqlite from "sqlite3";
import { open } from "sqlite";

const db = await open({
  filename: ":memory:",
  driver: sqlite.Database
})

await db.migrate();

export default db;