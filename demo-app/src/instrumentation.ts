import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { AzureMonitorTraceExporter } from "@azure/monitor-opentelemetry-exporter";
import { BatchSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";

export async function register() {
  // Only instrument server-side (Node.js runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "azure-foundry-hybrid-demo",
      [ATTR_SERVICE_VERSION]: "1.0.0",
    });

    const spanProcessors = [];

    // Azure Monitor exporter (sends traces to Application Insights)
    if (connectionString) {
      const azureExporter = new AzureMonitorTraceExporter({ connectionString });
      spanProcessors.push(new BatchSpanProcessor(azureExporter));
      console.log("[OTel] Azure Monitor exporter configured → Application Insights");
    }

    // Console exporter in dev (for debugging)
    if (process.env.NODE_ENV === "development") {
      spanProcessors.push(new BatchSpanProcessor(new ConsoleSpanExporter()));
    }

    const sdk = new NodeSDK({
      resource,
      spanProcessors,
      instrumentations: [
        new HttpInstrumentation({
          // Capture request/response headers for debugging
          requestHook: (span, request) => {
            span.setAttribute("http.request.path", (request as any).path || "");
          },
        }),
      ],
    });

    sdk.start();
    console.log("[OTel] OpenTelemetry SDK started");

    // Graceful shutdown
    process.on("SIGTERM", () => {
      sdk.shutdown().then(() => console.log("[OTel] SDK shut down"));
    });
  }
}
