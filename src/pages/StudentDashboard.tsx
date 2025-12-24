import { useState, useEffect } from 'react';
import { Shield, TrendingUp, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [score, setScore] = useState({ score: 100, risk_level: 'low', total_phishing_clicked: 0, total_phishing_reported: 0, total_safe_opened: 0 });
  const [actions, setActions] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    const { data: scoreData } = await supabase.from('scores').select('*').eq('user_id', user?.id).single();
    if (scoreData) setScore(scoreData);
    
    const { data: actionsData } = await supabase.from('user_actions').select('*, emails(subject, type)').eq('user_id', user?.id).order('created_at', { ascending: false }).limit(10);
    if (actionsData) setActions(actionsData);
  };

  const chartData = [
    { name: 'Clicked', value: score.total_phishing_clicked, fill: 'hsl(var(--destructive))' },
    { name: 'Reported', value: score.total_phishing_reported, fill: 'hsl(var(--success))' },
    { name: 'Safe Opened', value: score.total_safe_opened, fill: 'hsl(var(--primary))' },
  ];

  const getRiskColor = () => {
    switch (score.risk_level) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-warning';
      default: return 'text-success';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" /> Student Dashboard
          </h1>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Awareness Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold gradient-text">{score.score}/100</div>
                <Progress value={score.score} className="mt-3 h-2" />
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Risk Level</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold capitalize ${getRiskColor()}`}>{score.risk_level}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {score.risk_level === 'low' ? 'Great job! Keep it up.' : score.risk_level === 'medium' ? 'Be more careful with emails.' : 'You need more training!'}
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Phishing Reported</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-success">{score.total_phishing_reported}</div>
                <p className="text-sm text-muted-foreground mt-1">Good catches!</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Your Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Recent Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-auto">
                  {actions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No actions yet. Check your inbox!</p>
                  ) : (
                    actions.map((action) => (
                      <div key={action.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        {action.action === 'reported' ? <CheckCircle className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{action.emails?.subject || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground capitalize">{action.action.replace('_', ' ')}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
