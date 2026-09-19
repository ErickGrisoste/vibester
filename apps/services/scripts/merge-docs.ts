import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const ROOT = join(__dirname, '..');

interface ServiceConfig {
  name: string;
  prefix: string;
  env?: Record<string, string>;
  staticSpecFile?: string;
}

const services: ServiceConfig[] = [
  {
    name: 'auth-service',
    prefix: '/auth',
    env: {
      JWT_SECRET: 'ci-secret',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      PROFILE_SERVICE_URL: 'http://localhost:3003',
    },
  },
  {
    name: 'establishment-service',
    prefix: '/establishment',
    env: {
      JWT_SECRET: 'ci-secret',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      SERP_API_KEY: 'ci-dummy',
      r2_account_id: 'ci-dummy',
      r2_access_key_id: 'ci-dummy',
      r2_secret_access_key: 'ci-dummy',
      r2_bucket_name: 'ci-dummy',
      r2_public_url: 'http://ci-dummy',
    },
  },
  {
    name: 'event-service',
    prefix: '/event',
    env: { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' },
  },
  {
    name: 'feed-service',
    prefix: '/feed',
    env: {
      JWT_SECRET: 'ci-secret',
      ASTRA_SECURE_CONNECT_BUNDLE: '/dev/null',
      ASTRA_TOKEN: 'ci-dummy',
      ASTRA_CLIENT_ID: 'ci-dummy',
      ASTRA_CLIENT_SECRET: 'ci-dummy',
      ASTRA_KEYSPACE: 'feed_keyspace',
      KAFKA_BROKERS: 'localhost:9092',
    },
  },
  {
    name: 'post-service',
    prefix: '/post',
    env: {
      CASSANDRA_CONTACT_POINT: '127.0.0.1',
      CASSANDRA_DATACENTER: 'datacenter1',
      CASSANDRA_KEYSPACE: 'posts',
    },
  },
  {
    name: 'scrapping-service',
    prefix: '/scrapping',
    env: { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' },
  },
  {
    name: 'user-service',
    prefix: '/user',
    env: { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' },
  },
  {
    name: 'payment-service',
    prefix: '/payment',
    env: {
      JWT_SECRET: 'ci-secret',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      ABACATEPAY_API_KEY: 'ci-dummy',
      ABACATEPAY_WEBHOOK_SECRET: 'ci-dummy',
      KAFKA_BROKERS: 'localhost:9092',
    },
  },
];

const combined: any = {
  openapi: '3.0.3',
  info: {
    title: 'Vibester API',
    description: 'Documentação completa de todos os serviços da API do Vibester.',
    version: '1.0.0',
  },
  tags: [],
  paths: {},
  components: { schemas: {} },
};

for (const service of services) {
  console.error(`Gerando spec: ${service.name}...`);

  try {
    let spec: any;

    if (service.staticSpecFile) {
      const specPath = join(ROOT, service.name, service.staticSpecFile);
      spec = JSON.parse(readFileSync(specPath, 'utf-8'));
    } else {
      const dir = join(ROOT, service.name);
      const outFile = join(tmpdir(), `vibester-spec-${service.name}.json`);

      execSync(`npx tsx src/generate-spec.ts "${outFile}"`, {
        cwd: dir,
        env: { ...process.env, ...service.env },
        timeout: 30_000,
        stdio: 'pipe',
      });

      spec = JSON.parse(readFileSync(outFile, 'utf-8'));
      if (existsSync(outFile)) unlinkSync(outFile);
    }

    for (const tag of spec.tags ?? []) {
      if (!combined.tags.find((t: any) => t.name === tag.name)) {
        combined.tags.push(tag);
      }
    }

    for (const [path, methods] of Object.entries(spec.paths ?? {})) {
      combined.paths[`${service.prefix}${path}`] = methods;
    }

    Object.assign(combined.components.schemas, spec.components?.schemas ?? {});

    console.error(`  ✓ ${Object.keys(spec.paths ?? {}).length} rotas`);
  } catch (err: any) {
    console.error(`  ✗ Erro em ${service.name}: ${err.stderr?.toString() || err.message}`);
    process.exit(1);
  }
}

const outPath = join(ROOT, 'openapi.json');
writeFileSync(outPath, JSON.stringify(combined, null, 2));
console.error(`\nGerado: ${outPath}`);
