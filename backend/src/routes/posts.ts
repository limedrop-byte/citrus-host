import express from 'express';
import db from '../db';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Function to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Get all posts (public endpoint)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        p.id,
        p.title,
        p.content,
        p.slug,
        p.created_at,
        p.updated_at,
        u.name as author_name
      FROM posts p
      JOIN users u ON p.author_id = u.id
      ORDER BY p.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single post by slug (public endpoint)
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const result = await db.query(`
      SELECT 
        p.id,
        p.title,
        p.content,
        p.slug,
        p.created_at,
        p.updated_at,
        u.name as author_name
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.slug = $1
    `, [slug]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Create new post (admin only)
router.post('/', verifyToken, async (req, res) => {
  try {
    console.log('Creating post - User ID:', req.user?.id);
    console.log('Request body:', req.body);
    
    // Check if user is admin
    const userResult = await db.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user?.id]
    );
    
    console.log('User query result:', userResult.rows);
    
    if (!userResult.rows[0]?.is_admin) {
      console.log('User is not admin');
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { title, content } = req.body;
    
    if (!title || !content) {
      console.log('Missing title or content');
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // Generate slug from title
    const slug = generateSlug(title);
    console.log('Generated slug:', slug);
    
    // Check if slug already exists and make it unique if needed
    let uniqueSlug = slug;
    let counter = 1;
    while (true) {
      const existingSlug = await db.query('SELECT id FROM posts WHERE slug = $1', [uniqueSlug]);
      if (existingSlug.rows.length === 0) break;
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    console.log('Inserting post:', { title, content, slug: uniqueSlug, author_id: req.user?.id });

    const result = await db.query(`
      INSERT INTO posts (title, content, slug, author_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [title, content, uniqueSlug, req.user?.id]);
    
    console.log('Post created successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating post:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : String(error));
    res.status(500).json({ 
      error: 'Failed to create post', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Update post (admin only)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    const userResult = await db.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user?.id]
    );
    
    if (!userResult.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { title, content } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // Generate new slug from updated title
    const slug = generateSlug(title);
    
    // Check if slug already exists (excluding current post) and make it unique if needed
    let uniqueSlug = slug;
    let counter = 1;
    while (true) {
      const existingSlug = await db.query('SELECT id FROM posts WHERE slug = $1 AND id != $2', [uniqueSlug, id]);
      if (existingSlug.rows.length === 0) break;
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    const result = await db.query(`
      UPDATE posts 
      SET title = $1, content = $2, slug = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [title, content, uniqueSlug, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// Delete post (admin only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    const userResult = await db.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user?.id]
    );
    
    if (!userResult.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM posts WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router; 