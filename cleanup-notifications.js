/**
 * This script cleans up old notifications to improve system performance
 * 
 * It provides a maintenance task to:
 * 1. Remove notifications older than the specified retention period
 * 2. Limit the maximum number of notifications per user
 * 3. Identify and delete duplicate notifications
 * 
 * Usage: 
 * NODE_ENV=development node cleanup-notifications.js
 * 
 * Optional arguments:
 * --days=90     (retention period in days, default: 90)
 * --limit=1000  (max notifications per user, default: 1000)
 * --dry-run     (log what would be deleted without actually deleting)
 */

// Import database client
const { query, setRLSContext } = require('./src/infrastructure/database/client');
const { normalizeNotification, isDuplicateNotification } = require('./utils/notification-helper');

// Parse arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  days: 90,
  limit: 1000
};

// Parse days and limit options
args.forEach(arg => {
  if (arg.startsWith('--days=')) {
    options.days = parseInt(arg.split('=')[1], 10) || 90;
  } else if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.split('=')[1], 10) || 1000;
  }
});

console.log('Running notification cleanup with options:', options);

// Main function
async function main() {
  try {
    // Bypass RLS for admin operation
    await setRLSContext(null);
    
    // Get statistics before cleanup
    const beforeStats = await query(`
      SELECT COUNT(*) as total_count,
             COUNT(DISTINCT user_id) as user_count,
             MIN(created_at) as oldest,
             MAX(created_at) as newest
      FROM notifications
    `);
    
    console.log('Before cleanup:', {
      totalNotifications: beforeStats.rows[0].total_count,
      totalUsers: beforeStats.rows[0].user_count,
      oldestNotification: beforeStats.rows[0].oldest,
      newestNotification: beforeStats.rows[0].newest
    });
    
    // Step 1: Delete notifications older than the retention period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.days);
    
    // Get count of old notifications
    const oldNotificationsCount = await query(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE created_at < $1
    `, [cutoffDate.toISOString()]);
    
    console.log(`Found ${oldNotificationsCount.rows[0].count} notifications older than ${options.days} days`);
    
    // Delete old notifications if not dry run
    if (!options.dryRun && oldNotificationsCount.rows[0].count > 0) {
      const deleteOldResult = await query(`
        DELETE FROM notifications
        WHERE created_at < $1
        RETURNING COUNT(*) as deleted_count
      `, [cutoffDate.toISOString()]);
      
      console.log(`Deleted ${deleteOldResult.rows[0]?.deleted_count || 'unknown'} old notifications`);
    }
    
    // Step 2: Limit max notifications per user by deleting oldest read notifications
    // Get users with too many notifications
    const usersWithTooMany = await query(`
      SELECT user_id, COUNT(*) as notification_count
      FROM notifications
      GROUP BY user_id
      HAVING COUNT(*) > $1
      ORDER BY COUNT(*) DESC
    `, [options.limit]);
    
    console.log(`Found ${usersWithTooMany.rows.length} users with more than ${options.limit} notifications`);
    
    // Process each user
    for (const user of usersWithTooMany.rows) {
      const userId = user.user_id;
      const excessCount = user.notification_count - options.limit;
      
      console.log(`User ${userId} has ${user.notification_count} notifications (${excessCount} excess)`);
      
      if (!options.dryRun) {
        // Delete oldest read notifications first
        const deleteReadResult = await query(`
          DELETE FROM notifications
          WHERE id IN (
            SELECT id FROM notifications
            WHERE user_id = $1 AND read = TRUE
            ORDER BY created_at ASC
            LIMIT $2
          )
          RETURNING COUNT(*) as deleted_count
        `, [userId, excessCount]);
        
        const deletedReadCount = deleteReadResult.rows[0]?.deleted_count || 0;
        console.log(`Deleted ${deletedReadCount} read notifications for user ${userId}`);
        
        // If we still need to delete more, delete oldest unread
        if (deletedReadCount < excessCount) {
          const remainingToDelete = excessCount - deletedReadCount;
          
          const deleteUnreadResult = await query(`
            DELETE FROM notifications
            WHERE id IN (
              SELECT id FROM notifications
              WHERE user_id = $1
              ORDER BY created_at ASC
              LIMIT $2
            )
            RETURNING COUNT(*) as deleted_count
          `, [userId, remainingToDelete]);
          
          console.log(`Deleted ${deleteUnreadResult.rows[0]?.deleted_count || 0} additional notifications for user ${userId}`);
        }
      }
    }
    
    // Step 3: Get statistics after cleanup
    const afterStats = await query(`
      SELECT COUNT(*) as total_count,
             COUNT(DISTINCT user_id) as user_count
      FROM notifications
    `);
    
    console.log('After cleanup:', {
      totalNotifications: afterStats.rows[0].total_count,
      totalUsers: afterStats.rows[0].user_count,
      notificationsRemoved: beforeStats.rows[0].total_count - afterStats.rows[0].total_count
    });
    
    console.log('Notification cleanup completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error in cleanup script:', error);
    process.exit(1);
  }
}

// Run the main function
main();