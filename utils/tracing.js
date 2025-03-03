const opentelemetry = require('@opentelemetry/api');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { trace } = require('@opentelemetry/api');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { MySQLInstrumentation } = require('@opentelemetry/instrumentation-mysql');

// Configure the tracer
function setupTracing() {
  // Only enable in non-production environments unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_TRACING !== 'true') {
    console.log('Tracing disabled in production. Set ENABLE_TRACING=true to enable.');
    return;
  }

  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'subscription-service',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    }),
  });

  const zipkinExporter = new ZipkinExporter({
    url: process.env.ZIPKIN_URL || 'http://localhost:9411/api/v2/spans',
  });

  provider.addSpanProcessor(new SimpleSpanProcessor(zipkinExporter));

  // Register the provider with OpenTelemetry
  provider.register();

  // Instrument frameworks
  registerInstrumentations({
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new MySQLInstrumentation(),
    ],
  });

  console.log('OpenTelemetry tracing initialized');
}

// Get the tracer for a specific component
function getTracer(name) {
  return trace.getTracer(name);
}

// Utility function to create a span for subscription processing
function startSubscriptionProcessingSpan(subscriptionId) {
  const tracer = getTracer('subscription-processing');
  const span = tracer.startSpan('process_subscription');
  span.setAttribute('subscription.id', subscriptionId);
  return span;
}

// Utility function to create a span for notification delivery
function startNotificationDeliverySpan(notificationId, userId) {
  const tracer = getTracer('notification-delivery');
  const span = tracer.startSpan('deliver_notification');
  span.setAttribute('notification.id', notificationId);
  span.setAttribute('user.id', userId);
  return span;
}

// Utility function to create a span for payment processing
function startPaymentProcessingSpan(subscriptionId, amount) {
  const tracer = getTracer('payment-processing');
  const span = tracer.startSpan('process_payment');
  span.setAttribute('subscription.id', subscriptionId);
  span.setAttribute('payment.amount', amount);
  return span;
}

// Helper for wrapping async function with tracing
async function withSpan(spanName, operation, attributes = {}) {
  const tracer = getTracer('subscription-service');
  const span = tracer.startSpan(spanName);
  
  // Set attributes
  Object.entries(attributes).forEach(([key, value]) => {
    span.setAttribute(key, value);
  });
  
  try {
    const result = await operation();
    span.end();
    return result;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: opentelemetry.SpanStatusCode.ERROR });
    span.end();
    throw error;
  }
}

module.exports = {
  setupTracing,
  getTracer,
  startSubscriptionProcessingSpan,
  startNotificationDeliverySpan,
  startPaymentProcessingSpan,
  withSpan
}; 