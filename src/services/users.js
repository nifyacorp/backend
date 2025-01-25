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
    console.log('👤 Processing new user:', {
      userId: id,
      email,
      timestamp: new Date().toISOString()
    });

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );

    if (existingUser.rows.length > 0) {
      console.log('⚠️ User already exists:', {
        userId: id,
        timestamp: new Date().toISOString()
      });
      return existingUser.rows[0];
    }

    // Create new user profile
    const result = await query(
      `INSERT INTO users (id, email, name, created_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, email, name, createdAt || new Date()]
    );

    console.log('✅ User profile created:', {
      userId: id,
      timestamp: new Date().toISOString()
    });

    return result.rows[0];
  } catch (error) {
    console.error('❌ Failed to create user:', {
      error: error.message,
      code: error.code,
      userId: id,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}