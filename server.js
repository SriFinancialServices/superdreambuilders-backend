require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Middleware
app.use(cors({
  origin: ['https://superdreambuilders.netlify.app', 'http://localhost:3000', 'https://superdreambuilders.com'],
  credentials: true
}));
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://your-project.supabase.co',
  process.env.SUPABASE_KEY || 'your-anon-key'
);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// =====================
// AUTHENTICATION ROUTES
// =====================

// Register new member
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    // Validate inputs
    if (!email || !password || !firstName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Insert member into database
    const { data, error } = await supabase
      .from('members')
      .insert([{
        id: uuidv4(),
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        password_hash: hashedPassword,
        status: 'pending', // pending approval
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Send approval notification to admin (optional)
    console.log(`New member registered: ${email}`);

    res.status(201).json({
      message: 'Registration successful. Awaiting admin approval.',
      data: data[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Member login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get member from database
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if approved
    if (data.status !== 'approved') {
      return res.status(403).json({ error: 'Account pending admin approval' });
    }

    // Compare passwords
    const validPassword = await bcryptjs.compare(password, data.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: data.id, email: data.email, role: 'member' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      member: {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin login
app.post('/api/auth/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // For now, simple admin credentials (replace with database lookup)
    if (email !== 'admin@superdreambuilders.com' || password !== 'admin123') {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const token = jwt.sign(
      { email: 'admin@superdreambuilders.com', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Admin login successful',
      token,
      admin: { email: 'admin@superdreambuilders.com' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// MEMBER MANAGEMENT (Admin)
// =====================

// Get all members
app.get('/api/admin/members', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('id, first_name, last_name, email, phone, status, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      members: data || [],
      count: data?.length || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get pending members (approval queue)
app.get('/api/admin/pending-members', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('members')
      .select('id, first_name, last_name, email, phone, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({
      pending: data || [],
      count: data?.length || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve member
app.post('/api/admin/approve-member/:memberId', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;

    const { data, error } = await supabase
      .from('members')
      .update({ status: 'approved' })
      .eq('id', memberId)
      .select();

    if (error) throw error;

    res.json({
      message: 'Member approved',
      member: data[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject member
app.post('/api/admin/reject-member/:memberId', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;

    const { data, error } = await supabase
      .from('members')
      .update({ status: 'rejected' })
      .eq('id', memberId)
      .select();

    if (error) throw error;

    res.json({
      message: 'Member rejected',
      member: data[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete member
app.delete('/api/admin/members/:memberId', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;

    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;

    res.json({ message: 'Member deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// VIDEO & DOCUMENT MANAGEMENT (Admin)
// =====================

// Add video
app.post('/api/admin/videos', authenticateToken, async (req, res) => {
  try {
    const { title, category, description, videoSource, videoId, duration } = req.body;

    if (!title || !category || !videoId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('videos')
      .insert([{
        id: uuidv4(),
        title,
        category,
        description,
        video_source: videoSource,
        video_id: videoId,
        duration,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) throw error;

    res.status(201).json({
      message: 'Video added successfully',
      video: data[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all videos
app.get('/api/videos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ videos: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete video
app.delete('/api/admin/videos/:videoId', authenticateToken, async (req, res) => {
  try {
    const { videoId } = req.params;

    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId);

    if (error) throw error;

    res.json({ message: 'Video deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add document
app.post('/api/admin/documents', authenticateToken, async (req, res) => {
  try {
    const { title, category, description, documentType, url } = req.body;

    if (!title || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('documents')
      .insert([{
        id: uuidv4(),
        title,
        category,
        description,
        document_type: documentType,
        url,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) throw error;

    res.status(201).json({
      message: 'Document added successfully',
      document: data[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all documents
app.get('/api/documents', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ documents: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete document
app.delete('/api/admin/documents/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;

    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// ANALYTICS & STATS
// =====================

// Get dashboard stats
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    const memberCount = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved');

    const pendingCount = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    const videoCount = await supabase
      .from('videos')
      .select('id', { count: 'exact', head: true });

    const documentCount = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true });

    res.json({
      totalMembers: memberCount.count || 0,
      pendingApprovals: pendingCount.count || 0,
      totalVideos: videoCount.count || 0,
      totalDocuments: documentCount.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// MIDDLEWARE
// =====================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// =====================
// ERROR HANDLING & SERVER
// =====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'SuperDreamBuilders API is running' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 SuperDreamBuilders API running on port ${PORT}`);
});
