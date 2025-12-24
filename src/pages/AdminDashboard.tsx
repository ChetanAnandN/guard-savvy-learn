import { useState, useEffect } from 'react';
import { Users, Mail, AlertTriangle, TrendingUp } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalUsers: 0, totalEmails: 0, clickRate: 0 });
  const [highRiskUsers, setHighRiskUsers] = useState<any[]>([]);
  const [actionData, setActionData] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { data: users } = await supabase.from('users').select('*');
    const { data: emails } = await supabase.from('emails').select('*');
    const { data: actions } = await supabase.from('user_actions').select('*');
    const { data: scores } = await supabase.from('scores').select('*, users(email)').order('score', { ascending: true }).limit(5);

    const clicked = actions?.filter(a => a.action === 'clicked_link').length || 0;
    const total = actions?.length || 1;

    setStats({
      totalUsers: users?.length || 0,
      totalEmails: emails?.length || 0,
      clickRate: Math.round((clicked / total) * 100),
    });

    setHighRiskUsers(scores || []);

    const safe = actions?.filter(a => a.action === 'reported' || a.action === 'deleted').length || 0;
    const unsafe = actions?.filter(a => a.action === 'clicked_link' || a.action === 'typed_credentials').length || 0;
    setActionData([
      { name: 'Safe Actions', value: safe, fill: 'hsl(var(--success))' },
      { name: 'Unsafe Actions', value: unsafe, fill: 'hsl(var(--destructive))' },
    ]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">👨‍🏫 Instructor Dashboard</h1>

          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Students</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{stats.totalUsers}</div></CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Phishing Emails</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{stats.totalEmails}</div></CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Click-Through Rate</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold text-warning">{stats.clickRate}%</div></CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">High Risk Users</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold text-destructive">{highRiskUsers.filter(u => u.risk_level === 'high').length}</div></CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader><CardTitle>Safe vs Unsafe Actions</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={actionData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label>
                      {actionData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader><CardTitle>High-Risk Students</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {highRiskUsers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No data yet</p>
                  ) : (
                    highRiskUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <span className="text-sm font-medium">{user.users?.email || 'Unknown'}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">Score: {user.score}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${user.risk_level === 'high' ? 'bg-destructive/20 text-destructive' : user.risk_level === 'medium' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}`}>
                            {user.risk_level}
                          </span>
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
