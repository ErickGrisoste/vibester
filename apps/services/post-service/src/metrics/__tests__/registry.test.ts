import { describe, it, expect } from "vitest";
import {
  registry,
  httpRequestDuration,
  httpRequestsTotal,
  cassandraQueryDuration,
  cassandraFanoutPartialFailureTotal,
  cacheResultTotal,
  cacheInvalidationFailureTotal,
  kafkaPublishTotal,
  rateLimitExceededTotal,
  postsCreatedTotal,
  likesTotal,
  commentsTotal,
  presignedUrlGeneratedTotal,
} from "../registry";

describe("metrics registry", () => {
  it("expõe todas as métricas do serviço no formato Prometheus", async () => {
    httpRequestsTotal.inc({ method: "GET", route: "/posts/:postId", status_code: "200" });
    httpRequestDuration.observe({ method: "GET", route: "/posts/:postId", status_code: "200" }, 0.01);
    cassandraQueryDuration.observe({ table: "posts_by_id", outcome: "success" }, 0.001);
    cassandraFanoutPartialFailureTotal.inc({ operation: "createInAllViews" });
    cacheResultTotal.inc({ result: "hit", key_prefix: "post:id" });
    cacheInvalidationFailureTotal.inc();
    kafkaPublishTotal.inc({ topic: "posts", result: "success" });
    rateLimitExceededTotal.inc({ route: "/posts" });
    postsCreatedTotal.inc();
    likesTotal.inc({ action: "liked" });
    commentsTotal.inc({ action: "created" });
    presignedUrlGeneratedTotal.inc({ media_type: "IMAGE" });

    const output = await registry.metrics();

    for (const name of [
      "http_request_duration_seconds",
      "http_requests_total",
      "cassandra_query_duration_seconds",
      "cassandra_fanout_partial_failure_total",
      "cache_result_total",
      "cache_invalidation_failure_total",
      "kafka_publish_total",
      "rate_limit_exceeded_total",
      "posts_created_total",
      "likes_total",
      "comments_total",
      "presigned_url_generated_total",
      // métricas padrão de processo (client.collectDefaultMetrics)
      "process_cpu_user_seconds_total",
    ]) {
      expect(output).toContain(name);
    }
  });

  it("content-type é o esperado pelo Prometheus", () => {
    expect(registry.contentType).toContain("text/plain");
  });
});
