import fs from "fs/promises";
import path from "path";
import handlebars from "handlebars";
import { env } from "../config/env";

export async function renderTemplate(filename: string, data: Record<string, unknown>): Promise<string> {
  let templatePath: string;

  if (env.templatesDir) {
    templatePath = path.join(env.templatesDir, filename);
  } else {
    // Look for templates folder in root or app directory
    templatePath = path.resolve(process.cwd(), "templates", filename);
  }

  const source = await fs.readFile(templatePath, "utf-8");
  const template = handlebars.compile(source);
  return template(data);
}
