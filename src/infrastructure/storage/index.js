/**
 * Google Cloud Storage Client
 * 
 * This module provides a client for interacting with Google Cloud Storage.
 */

import { Storage } from '@google-cloud/storage';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../shared/logging/logger.js';

// Initialize storage client - uses default credentials
const storage = new Storage();

// Bucket name
const bucketName = 'nifya-assets';

// Profile pictures folder
const PROFILE_PICTURES_FOLDER = 'profile-pictures';

/**
 * Upload a file to Google Cloud Storage
 * 
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} fileName - Original file name
 * @param {string} userId - The user ID
 * @param {string} contentType - The file content type
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
export async function uploadProfilePicture(fileBuffer, fileName, userId, contentType) {
  try {
    // Extract file extension from the original name
    const fileExtension = path.extname(fileName).toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    if (!validExtensions.includes(fileExtension)) {
      throw new Error(`Invalid file extension. Allowed: ${validExtensions.join(', ')}`);
    }
    
    // Ensure user ID is sanitized (no slashes, etc.)
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    // Create the folder path: /profile-pictures/{userId}/
    const userFolder = `${PROFILE_PICTURES_FOLDER}/${sanitizedUserId}`;
    
    // Set the file name to match user ID: {userId}.{extension}
    const storageFileName = `${sanitizedUserId}${fileExtension}`;
    
    // Full destination path
    const destination = `${userFolder}/${storageFileName}`;
    
    // Get bucket reference
    const bucket = storage.bucket(bucketName);
    
    // Create a file reference in the bucket
    const file = bucket.file(destination);
    
    // Upload options
    const options = {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
        metadata: {
          uploadedBy: userId,
          uploadedAt: new Date().toISOString()
        }
      }
    };
    
    // Upload the file
    await file.save(fileBuffer, options);
    
    // Make the file publicly accessible
    await file.makePublic();
    
    // Generate a public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;
    
    logger.info(`Profile picture uploaded for user ${userId}`, {
      userId,
      destination,
      publicUrl
    });
    
    return publicUrl;
  } catch (error) {
    logger.error(`Error uploading profile picture for user ${userId}`, {
      userId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Delete a user's profile picture
 * 
 * @param {string} userId - The user ID
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
export async function deleteProfilePicture(userId) {
  try {
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const userFolder = `${PROFILE_PICTURES_FOLDER}/${sanitizedUserId}`;
    
    // Get bucket reference
    const bucket = storage.bucket(bucketName);
    
    // List all files in user's folder
    const [files] = await bucket.getFiles({ prefix: userFolder });
    
    if (files.length === 0) {
      logger.info(`No profile pictures found for user ${userId}`);
      return false;
    }
    
    // Delete all files in the folder
    await Promise.all(files.map(file => file.delete()));
    
    logger.info(`Deleted profile picture(s) for user ${userId}`, {
      userId,
      filesDeleted: files.length
    });
    
    return true;
  } catch (error) {
    logger.error(`Error deleting profile picture for user ${userId}`, {
      userId,
      error: error.message
    });
    throw error;
  }
}

export default {
  uploadProfilePicture,
  deleteProfilePicture,
  bucketName
}; 