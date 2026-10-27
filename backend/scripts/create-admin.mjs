import mysql from "mysql2/promise";
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

function askHidden(prompt) {
  if (!stdin.isTTY || !stdin.setRawMode) throw new Error("Run this command in an interactive terminal so the password can be hidden.");
  stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error) => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener("data", onData); stdout.write("\n"); error ? reject(error) : resolve(value); };
    const onData = (data) => {
      const key = data.toString("utf8");
      if (key === "\u0003") return finish(new Error("Cancelled."));
      if (key === "\r" || key === "\n") return finish();
      if (key === "\u0008" || key === "\u007f") { value = value.slice(0, -1); return; }
      value += key;
    };
    stdin.setRawMode(true); stdin.resume(); stdin.on("data", onData);
  });
}

const prompt = createInterface({ input: stdin, output: stdout });
let connection;
try {
  const fullName = (await prompt.question("Administrator full name: ")).trim();
  const email = (await prompt.question("Administrator email: ")).trim().toLowerCase();
  prompt.close();
  const password = await askHidden("Password (minimum 12 characters): ");
  const confirm = await askHidden("Confirm password: ");
  if (!fullName || !email.includes("@")) throw new Error("Enter a valid name and email address.");
  if (password.length < 12 || password !== confirm) throw new Error("Passwords must match and be at least 12 characters.");
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
  connection = await mysql.createConnection({ host: process.env.DB_HOST ?? "127.0.0.1", port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  await connection.execute("INSERT INTO admins (full_name,email,password_hash) VALUES (?,?,?)", [fullName, email, passwordHash]);
  stdout.write(`Administrator ${email} created.\n`);
} catch (error) {
  stdout.write(`${error instanceof Error ? error.message : "Could not create administrator."}\n`);
  process.exitCode = 1;
} finally {
  prompt.close();
  await connection?.end();
}
