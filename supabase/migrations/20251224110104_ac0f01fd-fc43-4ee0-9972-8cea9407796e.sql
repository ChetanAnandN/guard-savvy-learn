-- Create enum types
CREATE TYPE public.user_role AS ENUM ('student', 'instructor');
CREATE TYPE public.email_type AS ENUM ('phishing', 'safe', 'suspicious');
CREATE TYPE public.risk_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.user_action_type AS ENUM ('opened', 'clicked_link', 'typed_credentials', 'reported', 'deleted', 'marked_safe');

-- Users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OTP verifications table
CREATE TABLE public.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Simulated emails table
CREATE TABLE public.emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  preview_text TEXT,
  type email_type NOT NULL DEFAULT 'safe',
  risk_level risk_level NOT NULL DEFAULT 'low',
  indicators JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User actions table
CREATE TABLE public.user_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  email_id UUID REFERENCES public.emails(id) ON DELETE CASCADE NOT NULL,
  action user_action_type NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scores table
CREATE TABLE public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  score INTEGER NOT NULL DEFAULT 100,
  risk_level risk_level NOT NULL DEFAULT 'low',
  total_phishing_clicked INTEGER NOT NULL DEFAULT 0,
  total_phishing_reported INTEGER NOT NULL DEFAULT 0,
  total_safe_opened INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage users" ON public.users
  FOR ALL USING (true);

-- RLS Policies for OTP (service role only via edge functions)
CREATE POLICY "OTP managed by service" ON public.otp_verifications
  FOR ALL USING (true);

-- RLS Policies for emails (publicly readable for simulation)
CREATE POLICY "Emails are viewable by authenticated users" ON public.emails
  FOR SELECT USING (true);

CREATE POLICY "Service can manage emails" ON public.emails
  FOR ALL USING (true);

-- RLS Policies for user_actions
CREATE POLICY "Users can view their own actions" ON public.user_actions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own actions" ON public.user_actions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can manage actions" ON public.user_actions
  FOR ALL USING (true);

-- RLS Policies for scores
CREATE POLICY "Users can view scores" ON public.scores
  FOR SELECT USING (true);

CREATE POLICY "Service can manage scores" ON public.scores
  FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_otp_email ON public.otp_verifications(email);
CREATE INDEX idx_user_actions_user ON public.user_actions(user_id);
CREATE INDEX idx_user_actions_email ON public.user_actions(email_id);
CREATE INDEX idx_scores_user ON public.scores(user_id);

-- Insert sample phishing and safe emails for simulation
INSERT INTO public.emails (sender, sender_email, subject, body_html, preview_text, type, risk_level, indicators) VALUES
-- Phishing emails
('IT Security Team', 'security@c0llege-it.com', 'URGENT: Your Account Will Be Suspended', 
'<div style="font-family: Arial, sans-serif; padding: 20px;"><img src="https://via.placeholder.com/150x50?text=College+IT" alt="College IT"/><h2 style="color: #d32f2f;">⚠️ Account Suspension Warning</h2><p>Dear Student,</p><p>We have detected <strong>suspicious activity</strong> on your college account. Your account will be <strong>SUSPENDED within 24 hours</strong> unless you verify your credentials immediately.</p><p><a href="/phishing-trap" style="background: #d32f2f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Now - Click Here</a></p><p>Failure to comply will result in permanent account deletion.</p><p>IT Security Team</p></div>',
'URGENT: Your account will be suspended unless you verify immediately...', 'phishing', 'high',
'["Spoofed domain (c0llege-it.com instead of college.edu)", "Urgency language", "Threatening consequences", "Suspicious link"]'),

('College Financial Aid', 'finaid@student-portal.net', 'Your Scholarship Has Been Approved!',
'<div style="font-family: Arial, sans-serif; padding: 20px;"><h2 style="color: #2e7d32;">🎉 Congratulations!</h2><p>Dear Student,</p><p>Great news! You have been selected for a <strong>$5,000 Emergency Scholarship</strong>. To claim your funds, please verify your student ID and banking information.</p><p><a href="/phishing-trap" style="background: #2e7d32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Claim Scholarship Now</a></p><p>This offer expires in 48 hours.</p><p>Financial Aid Office</p></div>',
'You have been selected for a $5,000 scholarship! Claim now...', 'phishing', 'high',
'["External domain (student-portal.net)", "Too good to be true offer", "Requests banking information", "Artificial urgency"]'),

('PayPal Security', 'no-reply@paypa1-security.com', 'Unusual Sign-In Activity Detected',
'<div style="font-family: Arial, sans-serif; padding: 20px;"><img src="https://via.placeholder.com/100x40?text=PayPal" alt="PayPal"/><h2>We noticed something unusual</h2><p>Someone tried to access your PayPal account from an unknown device.</p><p><strong>Location:</strong> Unknown<br/><strong>Time:</strong> Today at 3:42 AM</p><p>If this was not you, secure your account immediately:</p><p><a href="/phishing-trap" style="background: #003087; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Secure My Account</a></p></div>',
'Someone tried to access your account from an unknown location...', 'phishing', 'high',
'["Misspelled domain (paypa1 with number 1)", "Fear-inducing content", "Suspicious login claims", "Generic greeting"]'),

-- Suspicious emails
('Amazon Customer Service', 'support@amaz0n-orders.com', 'Order Confirmation #38291',
'<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>Order Confirmed</h2><p>Thank you for your order!</p><p><strong>Order Total:</strong> $847.99<br/><strong>Items:</strong> MacBook Pro 14"</p><p>Did not place this order? <a href="/phishing-trap">Cancel immediately</a></p></div>',
'Your order of $847.99 has been confirmed...', 'suspicious', 'medium',
'["Suspicious domain with zero instead of o", "High-value item you did not order", "Urgency to click link"]'),

-- Safe emails
('College Library', 'library@college.edu', 'Book Return Reminder',
'<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>📚 Library Notice</h2><p>Dear Student,</p><p>This is a friendly reminder that the following book is due for return on January 5th:</p><p><strong>"Introduction to Computer Science"</strong> - ISBN: 978-0134670959</p><p>You can return it to the main library desk during business hours.</p><p>Best regards,<br/>College Library</p></div>',
'Reminder: Your library book is due for return...', 'safe', 'low', '[]'),

('Professor Smith', 'j.smith@college.edu', 'Office Hours Update - CS101',
'<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>Office Hours Change</h2><p>Dear Students,</p><p>Due to the faculty meeting, my office hours for this week will be moved to Thursday 2-4 PM instead of Wednesday.</p><p>Location remains Room 302, Science Building.</p><p>Best,<br/>Prof. Smith</p></div>',
'Office hours moved to Thursday 2-4 PM this week...', 'safe', 'low', '[]'),

('College Registrar', 'registrar@college.edu', 'Spring Semester Registration Open',
'<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>Registration Now Open</h2><p>Dear Student,</p><p>Spring 2025 course registration is now open. Please log in to the student portal using your college credentials to register for classes.</p><p>Registration closes on January 15th.</p><p>Registrar Office</p></div>',
'Spring 2025 registration is now open...', 'safe', 'low', '[]'),

('Campus Events', 'events@college.edu', 'Tech Career Fair Next Week',
'<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>🎯 Tech Career Fair</h2><p>Join us for the Annual Tech Career Fair!</p><p><strong>Date:</strong> January 10th, 2025<br/><strong>Time:</strong> 10 AM - 4 PM<br/><strong>Location:</strong> Student Center Hall A</p><p>Over 50 tech companies will be recruiting!</p></div>',
'Tech Career Fair - January 10th at Student Center...', 'safe', 'low', '[]');