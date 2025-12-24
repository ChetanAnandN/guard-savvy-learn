import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function PhishingTrap() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Record that user typed credentials (DO NOT STORE THE ACTUAL CREDENTIALS)
    if (user) {
      const urlParams = new URLSearchParams(window.location.search);
      const emailId = urlParams.get('from');
      if (emailId) {
        await supabase.functions.invoke('record-action', {
          body: { userId: user.id, emailId, action: 'typed_credentials' },
        });
      }
    }
    
    setShowWarning(true);
  };

  const handleLinkClick = async () => {
    if (user) {
      const urlParams = new URLSearchParams(window.location.search);
      const emailId = urlParams.get('from');
      if (emailId) {
        await supabase.functions.invoke('record-action', {
          body: { userId: user.id, emailId, action: 'clicked_link' },
        });
      }
    }
  };

  // Record link click on mount
  useState(() => {
    handleLinkClick();
  });

  if (showWarning) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
        <div className="max-w-lg w-full bg-card rounded-2xl p-8 text-center animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-warning/20 mx-auto flex items-center justify-center mb-6">
            <Shield className="h-10 w-10 text-warning" />
          </div>
          <h1 className="text-2xl font-bold mb-4">🎓 This Was a Training Exercise!</h1>
          <p className="text-muted-foreground mb-6">
            You just entered credentials on a fake login page. In a real attack, your information would now be compromised.
          </p>
          <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left">
            <h3 className="font-semibold mb-2">🔒 What to look for:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Check the URL carefully for misspellings</li>
              <li>• Look for the padlock icon and HTTPS</li>
              <li>• Verify the sender's email address</li>
              <li>• Be suspicious of urgent requests</li>
            </ul>
          </div>
          <Button onClick={() => navigate('/inbox')} className="btn-gradient">
            Return to Inbox
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full mx-auto flex items-center justify-center mb-4">
            <span className="text-white text-2xl font-bold">CU</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">College University</h1>
          <p className="text-gray-600 text-sm">Student Portal Login</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@college.edu" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Sign In</Button>
        </form>
        
        <p className="text-xs text-gray-500 text-center mt-6">
          By signing in, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
