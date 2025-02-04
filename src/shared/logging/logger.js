export function logRequest(context, message, data = {}) {
  console.log(`📝 ${message}:`, {
    ...data,
    requestId: context.requestId,
    path: context.path,
    timestamp: new Date().toISOString()
  });
}

export function logError(context, error, additionalData = {}) {
  console.error('❌ Error:', {
    code: error.code,
    message: error.message,
    stack: error.stack,
    ...additionalData,
    requestId: context.requestId,
    path: context.path,
    timestamp: new Date().toISOString()
  });
}

export function logPubSub(context, message, data = {}) {
  console.log(`📨 ${message}:`, {
    ...data,
    requestId: context.requestId,
    path: context.path,
    timestamp: new Date().toISOString()
  });
}

export function logProcessing(context, message, data = {}) {
  console.log(`⚙️ ${message}:`, {
    ...data,
    requestId: context.requestId,
    path: context.path,
    timestamp: new Date().toISOString()
  });
}

export function logAuth(context, message, data = {}) {
  console.log(`🔒 ${message}:`, {
    ...data,
    requestId: context.requestId,
    path: context.path,
    timestamp: new Date().toISOString()
  });
}