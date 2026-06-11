-- SuperDreamBuilders Database Schema
-- Run this SQL in your Supabase SQL editor

-- Members Table
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(50) CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Videos Table
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  video_source VARCHAR(50) CHECK (video_source IN ('youtube', 'bunny', 'csv')) DEFAULT 'youtube',
  video_id VARCHAR(255) NOT NULL,
  duration VARCHAR(50),
  thumbnail_url VARCHAR(500),
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  document_type VARCHAR(50) CHECK (document_type IN ('pdf', 'word', 'excel')) DEFAULT 'pdf',
  url VARCHAR(500),
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments Table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Watch History Table (for tracking member views)
CREATE TABLE IF NOT EXISTS watch_history (
  id UUID PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration_watched INTEGER DEFAULT 0
);

-- Admin Activities Log
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY,
  action VARCHAR(255) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_videos_category ON videos(category);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_comments_video ON comments(video_id);
CREATE INDEX idx_watch_history_member ON watch_history(member_id);

-- Enable Row Level Security (RLS) for security
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow public read on videos/documents, authenticated write)
CREATE POLICY "Public can read videos" ON videos FOR SELECT USING (true);
CREATE POLICY "Public can read documents" ON documents FOR SELECT USING (true);
CREATE POLICY "Members can read other members (non-sensitive)" ON members FOR SELECT USING (
  status = 'approved'
);
