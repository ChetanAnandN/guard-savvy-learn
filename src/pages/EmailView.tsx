import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Flag, Trash2, Shield, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Email {
  id: string;
  sender: string;
  sender_email: string;
  subject: string;
  body_html: string;
  type: 'phishing' | 'safe' | 'suspicious';
  risk_level: 'low' | 'medium' | 'high';
  indicators: string[];
}

export default function EmailView() {
  const { id } = useParams();
  const [email, setEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) fetchEmail();
  }, [id]);

  const fetchEmail = async () => {
    const { data } = await supabase.from('emails').select('*').eq('id', id).single();
    if (data) {
      const indicators = Array.isArray(data.indicators) ? data.indicators.map(String) : [];
      setEmail({ ...data, indicators } as Email);
      if (user) {
        await supabase.functions.invoke('record-action', { body: { userId: user.id, emailId: id, action: 'opened' } });
      }
    }
    setIsLoading(false);
  };

  const handleAction = async (action: 'reported' | 'deleted' | 'blocked') => {
    if (!user || !email) return;
    const result = await supabase.functions.invoke('record-action', { body: { userId: user.id, emailId: email.id, action } });
    const data = result.data;
    
    if (data?.alreadyRecorded) {
      toast({ title: `Already ${action}!`, description: 'This action was already recorded for this email.' });
    } else {
      const titles = {
        reported: '🚨 Reported!',
        deleted: '🗑️ Deleted!',
        blocked: '🚫 Blocked!'
      };
      toast({ title: titles[action] });
    }
    navigate('/inbox');
  };

  // useMemo MUST be called unconditionally (before any early returns)
  const renderedBodyHtml = useMemo(() => {
    if (!email) return '';
    try {
      const doc = new DOMParser().parseFromString(email.body_html, 'text/html');
      doc.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
        const rawHref = a.getAttribute('href');
        if (!rawHref) return;

        const url = new URL(rawHref, window.location.origin);
        if (url.pathname === '/phishing-trap') {
          url.searchParams.set('from', email.id);
          a.setAttribute('href', `${url.pathname}?${url.searchParams.toString()}`);
        }
      });
      return doc.body.innerHTML;
    } catch {
      return email.body_html;
    }
  }, [email?.body_html, email?.id]);

  const handleBodyClick = useCallback<React.MouseEventHandler<HTMLDivElement>>((e) => {
    if (!email) return;
    const target = e.target as HTMLElement | null;
    const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
    if (!anchor) return;

    const rawHref = anchor.getAttribute('href');
    if (!rawHref) return;

    const url = new URL(rawHref, window.location.origin);
    if (url.pathname === '/phishing-trap') {
      e.preventDefault();
      url.searchParams.set('from', email.id);
      navigate(`${url.pathname}?${url.searchParams.toString()}`);
    }
  }, [email?.id, navigate]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!email) return <div className="min-h-screen flex items-center justify-center">Email not found</div>;

  const isPhishing = email.type === 'phishing' || email.type === 'suspicious';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          <Link to="/inbox" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" /> Back to Inbox
          </Link>

          {isPhishing && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-destructive">⚠️ Warning: This email may be dangerous</h3>
                <p className="text-sm text-destructive/80">This email has been flagged as {email.type}. Risk Level: {email.risk_level.toUpperCase()}</p>
              </div>
            </div>
          )}

          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-6 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold mb-2">{email.subject}</h1>
                  <p className="text-muted-foreground">From: <span className="font-medium">{email.sender}</span> &lt;{email.sender_email}&gt;</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleAction('reported')} className="gap-2">
                    <Flag className="h-4 w-4" /> Report
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleAction('blocked')} className="gap-2 text-destructive hover:text-destructive">
                    <Ban className="h-4 w-4" /> Block
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleAction('deleted')} className="gap-2">
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Badge variant={email.type === 'phishing' ? 'destructive' : email.type === 'suspicious' ? 'secondary' : 'default'}>
                  {email.type.toUpperCase()}
                </Badge>
                <Badge variant="outline">Risk: {email.risk_level.toUpperCase()}</Badge>
              </div>
            </div>

            <div
              className="p-6"
              onClick={handleBodyClick}
              dangerouslySetInnerHTML={{ __html: renderedBodyHtml }}
            />

            {isPhishing && email.indicators.length > 0 && (
              <div className="p-6 border-t border-border bg-muted/30">
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-warning">
                    <Shield className="h-4 w-4" /> Why this email may be dangerous
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4">
                    <ul className="space-y-2">
                      {email.indicators.map((indicator, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                          {indicator}
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
