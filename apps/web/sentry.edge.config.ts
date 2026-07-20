import * as Sentry from "@sentry/nextjs";
import { createServerSentryOptions } from "./lib/observability-config";

const options = createServerSentryOptions();

if (options) {
  Sentry.init(options);
}
