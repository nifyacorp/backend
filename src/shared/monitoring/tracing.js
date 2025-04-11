/**
 * OpenTelemetry Tracing Integration
 * 
 * This file provides tracing utilities using OpenTelemetry.
 */

import * as opentelemetry from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

// Configure the tracer
export function setupTracing() {
  // Only enable in non-production environments unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_TRACING !== 'true') {
    console.log('Tracing disabled in production. Set ENABLE_TRACING=true to enable.');
    return;
  }

  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'backend-service',
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
    ],
  });

  console.log('OpenTelemetry tracing initialized');
}

// Get the tracer for a specific component
export function getTracer(name) {
  return opentelemetry.trace.getTracer(name);
}

// Utility function to create a span for subscription processing
export function startSubscriptionProcessingSpan(subscriptionId) {
  const tracer = getTracer('subscription-processing');
  const span = tracer.startSpan('process_subscription');
  span.setAttribute('subscription.id', subscriptionId);
  return span;
}

// Utility function to create a span for notification delivery
export function startNotificationDeliverySpan(notificationId, userId) {
  const tracer = getTracer('notification-delivery');
  const span = tracer.startSpan('deliver_notification');
  span.setAttribute('notification.id', notificationId);
  span.setAttribute('user.id', userId);
  return span;
}

// Helper for wrapping async function with tracing
export async function withSpan(spanName, operation, attributes = {}) {
  const tracer = getTracer('backend-service');
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