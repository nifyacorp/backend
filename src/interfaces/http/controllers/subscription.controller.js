import { errorBuilders } from '../../../shared/errors/ErrorResponseBuilder.js';

/**
 * Example controller method for processing a subscription, showing usage of self-documenting errors
 */
export async function processSubscription(req, res, next) {
  const { id } = req.params;
  const { force = false } = req.query;
  
  try {
    // Example validation
    if (!id) {
      return next(errorBuilders.badRequest(req, 'Subscription ID is required'));
    }
    
    // UUID validation can now be handled by the apiDocumenter middleware
    // But we could do additional business logic validations here
    
    // Mock check if subscription exists
    const subscriptionExists = await checkSubscriptionExists(id);
    
    if (!subscriptionExists) {
      return next(errorBuilders.notFound(req, 'Subscription'));
    }
    
    // Check if user has access to this subscription
    const userId = req.user?.id; // Assuming authentication middleware adds user
    const hasAccess = await checkUserAccess(id, userId);
    
    if (!hasAccess) {
      return next(errorBuilders.forbidden(req, 'You do not have permission to process this subscription'));
    }
    
    // Check if the subscription was recently processed
    const recentlyProcessed = await wasRecentlyProcessed(id);
    
    if (recentlyProcessed && !force) {
      return next(errorBuilders.badRequest(
        req, 
        'This subscription was processed recently. Use force=true to override.', 
        { force: 'Set to true to force processing' }
      ));
    }
    
    // Process the subscription (mock implementation)
    const result = await processSubscriptionById(id);
    
    return res.status(200).json({
      success: true,
      message: 'Subscription processing initiated',
      processing_id: result.processing_id
    });
  } catch (error) {
    return next(errorBuilders.serverError(req, error));
  }
}

// Mock implementations for demonstration
async function checkSubscriptionExists(id) {
  // In a real implementation, this would check a database
  return true;
}

async function checkUserAccess(subscriptionId, userId) {
  // In a real implementation, this would check permissions
  return !!userId;
}

async function wasRecentlyProcessed(id) {
  // In a real implementation, this would check processing history
  return false;
}

async function processSubscriptionById(id) {
  // In a real implementation, this would start the processing job
  return { processing_id: `proc_${Date.now()}` };
}

/**
 * Controller method to get the processing status of a subscription
 */
export async function getSubscriptionStatusController(req, res, next) {
  const { id } = req.params;
  const userId = req.user?.id;
  const context = req.context;

  logRequest(context, 'Controller: getSubscriptionStatusController called', { userId, subscriptionId: id });

  if (!userId) {
    return next(errorBuilders.unauthorized(req, 'Authentication required'));
  }

  if (!id) {
    return next(errorBuilders.badRequest(req, 'Subscription ID is required in the path'));
  }

  try {
    const subscriptionService = req.app.locals.services.subscriptionService;
    const status = await subscriptionService.getSubscriptionStatus(userId, id, context);
    
    // Handle case where status is found but indicates no processing records
    if (status.status === 'unknown') {
        return res.status(200).json(status); // Return 200 but with the specific message
    }

    // Otherwise, return the status record
    return res.status(200).json(status);

  } catch (error) {
    logError(context, error, 'Controller: Error in getSubscriptionStatusController', { userId, subscriptionId: id });
    return next(error); // Let the error handler middleware format the response
  }
}

/**
 * Controller method to delete all subscriptions for the authenticated user
 */
export async function deleteUserSubscriptionsController(req, res, next) {
  const userId = req.user?.id;
  const context = req.context;

  logRequest(context, 'Controller: deleteUserSubscriptionsController called', { userId });

  if (!userId) {
    return next(errorBuilders.unauthorized(req, 'Authentication required'));
  }

  try {
    const subscriptionService = req.app.locals.services.subscriptionService;
    const result = await subscriptionService.deleteUserSubscriptions(userId, context);
    
    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} subscriptions.`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    logError(context, error, 'Controller: Error in deleteUserSubscriptionsController', { userId });
    return next(error); // Let the error handler middleware format the response
  }
}

// Note: Need to add routes for these controller methods
// e.g., router.get('/:id/status', authMiddleware, getSubscriptionStatusController);
//       router.post('/:id/process', authMiddleware, processSubscription); 