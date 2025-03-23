export function logRequest(context, message, data = {}) {
  console.log(`📝 ${message}:`, {
    ...data,
    requestId: context.requestId,
    path: context.path,
    timestamp: new Date().toISOString()
  });
}

export function logError(context, error, additionalData = {}) {
  // Check if error is already a plain object with an 'error' property
  if (error && typeof error === 'object' && !error.message && error.error) {
    console.error('❌ Error:', {
      error: error.error,
      subscription_id: error.subscription_id,
      ...additionalData,
      requestId: context.requestId,
      path: context.path,
      timestamp: new Date().toISOString()
    });
  } else {
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