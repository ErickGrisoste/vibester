import fs from "fs";
import path from "path";
import "dotenv/config"
import { Client } from "cassandra-driver";

const KEYSPACE = process.env.ASTRA_KEYSPACE;
const BUNDLE_PATH = process.env.ASTRA_SECURE_CONNECT_BUNDLE;
const CLIENT_ID = process.env.ASTRA_CLIENT_ID;
const CLIENT_SECRET = process.env.ASTRA_CLIENT_SECRET;

// CASSANDRA_CONTACT_POINTS presente => cluster OSS local/CI (docker-compose), sem Astra.
const CONTACT_POINTS = process.env.CASSANDRA_CONTACT_POINTS;
const LOCAL_DATA_CENTER = process.env.CASSANDRA_LOCAL_DATA_CENTER || "datacenter1";
const IS_LOCAL = Boolean(CONTACT_POINTS);

if (!KEYSPACE) throw new Error("ASTRA_KEYSPACE não definida");

if (!IS_LOCAL) {
    if (!BUNDLE_PATH) throw new Error("ASTRA_SECURE_CONNECT_BUNDLE não definida");
    if (!CLIENT_ID) throw new Error("ASTRA_CLIENT_ID não definida");
    if (!CLIENT_SECRET) throw new Error("ASTRA_CLIENT_SECRET não definida");
}

const contactPoints = () => CONTACT_POINTS!.split(",").map((cp) => cp.trim());

async function ensureKeyspace() {
    // Só necessário em cluster local — no Astra o keyspace já é provisionado externamente.
    const bootstrapClient = new Client({
        contactPoints: contactPoints(),
        localDataCenter: LOCAL_DATA_CENTER,
    });

    await bootstrapClient.connect();
    await bootstrapClient.execute(
        `CREATE KEYSPACE IF NOT EXISTS ${KEYSPACE} WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};`
    );
    await bootstrapClient.shutdown();
}

const client = IS_LOCAL
    ? new Client({
        contactPoints: contactPoints(),
        localDataCenter: LOCAL_DATA_CENTER,
        keyspace: KEYSPACE,
    })
    : new Client({
        cloud: {
            secureConnectBundle: BUNDLE_PATH!,
        },
        credentials: {
            username: CLIENT_ID!,
            password: CLIENT_SECRET!,
        },
        keyspace: KEYSPACE,
    });

async function ensureMigrationTable() {
    await client.execute(
        `
            CREATE TABLE IF NOT EXISTS ${KEYSPACE}.schema_migrations (
                version text PRIMARY KEY,
                executed_at timestamp
            );
        `
    );
}

async function getExecutedMigrations(): Promise<Set<string>> {
    const result = await client.execute(
        `SELECT version FROM ${KEYSPACE}.schema_migrations`
    );

    return new Set(result.rows.map((row) => row.version as string));
}

async function registerMigration(version: string) {
    await client.execute(
        `
            INSERT INTO ${KEYSPACE}.schema_migrations
            (version, executed_at)
            VALUES (?, toTimestamp(now()))
        `,
        [version],
        { prepare: true }
    );
}

async function run() {
    if (IS_LOCAL) {
        await ensureKeyspace();
    }

    await client.connect();
    console.log(KEYSPACE);

    await ensureMigrationTable();

    const executed = await getExecutedMigrations();

    const migrationsPath = path.resolve("migrations");

    const files = fs
        .readdirSync(migrationsPath)
        .filter((file) => file.endsWith(".cql"))
        .sort();

    for (const file of files) {
        const version = file.split("__")[0];

        if (executed.has(version)) { continue; }

        console.log(`${file}`);

        const content = fs.readFileSync(
            path.join(migrationsPath, file),
            "utf8"
        );

        await client.execute(content);
        await registerMigration(version);

        console.log(`${version} executada`);
    }

    console.log("Migrate Finalizado");

    await client.shutdown();
}

run().catch((error) => {
    console.error("Erro ao executar o migrate");
    console.error(error);
    process.exit(1);
});