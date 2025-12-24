import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertTriangle, CheckCircle, Shield, Search, Trash2, Flag, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Email {
  id: string;
  sender: string;
  sender_email: string;
  subject: string;
  preview_text: string;
  type: 'phishing' | 'safe' | 'suspicious';
  risk_level: 'low' | 'medium' | 'high';
  created_at: string;
}

export default function Inbox() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [filter, setFilter] = useState<'all' | 'phishing' | 'safe' | 'suspicious'>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    const { data, error } = await supabase.from('emails').select('*').order('created_at', { ascending: false });
    if (data) setEmails(data as Email[]);
    setIsLoading(false);
  };

  const handleAction = async (emailId: string, action: 'reported' | 'deleted') => {
    if (!user) return;
    try {
      await supabase.functions.invoke('record-action', {
        body: { userId: user.id, emailId, action },
      });
      toast({
        title: action === 'reported' ? '🚨 Email Reported' : '🗑️ Email Deleted',
        description: action === 'reported' ? 'Thanks for reporting this email!' : 'Email moved to trash.',
      });
    } catch (error) {
      console.error('Error recording action:', error);
    }
  };

  const filteredEmails = emails.filter(email => {
    const matchesFilter = filter === 'all' || email.type === filter;
    const matchesSearch = email.subject.toLowerCase().includes(search.toLowerCase()) ||
                          email.sender.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getEmailClass = (type: string) => {
    switch (type) {
      case 'phishing': return 'email-phishing';
      case 'suspicious': return 'email-suspicious';
      default: return 'email-safe';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'phishing': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'suspicious': return <Shield className="h-4 w-4 text-warning" />;
      default: return <CheckCircle className="h-4 w-4 text-success" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" /> Inbox
            </h1>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search emails..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="flex gap-2">
              {(['all', 'phishing', 'safe', 'suspicious'] as const).map((f) => (
                <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="capitalize">
                  {f}
                </Button>
              ))}
            </div>
          </div>

          {/* Email List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading emails...</div>
            ) : filteredEmails.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No emails found</div>
            ) : (
              filteredEmails.map((email) => (
                <Link key={email.id} to={`/email/${email.id}`} className="block">
                  <div className={`glass-card p-4 rounded-xl card-hover ${getEmailClass(email.type)}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeIcon(email.type)}
                          <span className="font-semibold truncate">{email.sender}</span>
                          <Badge variant={email.type === 'phishing' ? 'destructive' : email.type === 'suspicious' ? 'secondary' : 'default'} className="text-xs">
                            {email.type.toUpperCase()}
                          </Badge>
                        </div>
                        <h3 className="font-medium truncate">{email.subject}</h3>
                        <p className="text-sm text-muted-foreground truncate">{email.preview_text}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); handleAction(email.id, 'reported'); }}>
                          <Flag className="h-4 w-4 text-warning" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); handleAction(email.id, 'deleted'); }}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(email.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
