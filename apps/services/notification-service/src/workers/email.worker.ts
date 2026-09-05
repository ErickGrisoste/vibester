import { EmailNotification } from "../types/email.types";
import { sendEmailWithRetry } from "../services/email.service";

export const emailQueue: EmailNotification[] = [];
let activeWorkers = 0;
const MAX_CONCURRENT_WORKERS = 5;

export function enqueueEmail(notification: EmailNotification): void {
  emailQueue.push(notification);
  processQueue();
}

function processQueue(): void {
  while (activeWorkers < MAX_CONCURRENT_WORKERS && emailQueue.length > 0) {
    const item = emailQueue.shift();
    if (!item) break;

    activeWorkers++;
    const startTime = Date.now();

    sendEmailWithRetry(item)
      .catch((err) => {
        console.error("[EmailWorker] Worker error:", err);
      })
      .finally(() => {
        activeWorkers--;
        console.log(`[EmailWorker] Processed email for ${item.to} in ${Date.now() - startTime}ms`);
        processQueue();
      });
  }
}
