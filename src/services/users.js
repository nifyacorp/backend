import { query } from '../config/database.js';

export async function handleNewUser(userData) {
  const {
    id,
    email,
    name,
    createdAt,
    emailVerified
  } = userData;

  try {
    console.log('👤 Creating new user profile:', {
      userId: id,
      email,
      timestamp: new Date().toISOString()
    });

    const result = await query(
      `INSERT INTO users (id, email, name, created_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, email, name, createdAt]
    );

    console.log('✅ User profile created successfully:', {
      userId: id,
      timestamp: new Date().toISOString()
    });

    return result.rows[0];
  } catch (error) {
    console.error('❌ Failed to create user profile:', {
      error: error.message,
      userId: id,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}