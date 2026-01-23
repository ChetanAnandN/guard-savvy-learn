import { useState, useEffect } from 'react';
import { Shield, Users, TrendingUp, AlertTriangle, BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, PieChart, Pie, Cell, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { calculateScore, getRiskLevel, getRiskComment, ActionCounts, SCORING_CONFIG } from '@/lib/scoring';

interface UserStats {
  email: string;
  score: number;
  riskLevel: string;
  actions: ActionCounts;
  hasInteracted: boolean;
}

export default function InstructorAnalytics() {
  const { user, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.email) {
      setIsLoading(false);
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.email]);

  const fetchData = async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'list', adminEmail: user.email },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const userStats: UserStats[] = (data.users || []).map((u: any) => {
        const actions: ActionCounts = {
          clicked_link: u.action_counts?.clicked_link || 0,
          typed_credentials: u.action_counts?.typed_credentials || 0,
          reported: u.action_counts?.reported || 0,
          blocked: u.action_counts?.blocked || 0,
          deleted: u.action_counts?.deleted || 0,
        };
        const score = typeof u.score === 'number' ? u.score : calculateScore(actions);
        const hasInteracted = typeof u.has_interacted === 'boolean'
          ? u.has_interacted
          : Object.values(actions).some((v) => v > 0);
        return {
          email: u.email,
          score,
          riskLevel: (u.risk_level as string) || getRiskLevel(score),
          actions,
          hasInteracted,
        };
      });

      setUsers(userStats);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate averages
  const interactedUsers = users.filter(u => u.hasInteracted);
  const avgScore = interactedUsers.length > 0 
    ? Math.round(interactedUsers.reduce((sum, u) => sum + u.score, 0) / interactedUsers.length) 
    : SCORING_CONFIG.Sbase;
  
  const avgClicked = interactedUsers.length > 0 
    ? (interactedUsers.reduce((sum, u) => sum + u.actions.clicked_link, 0) / interactedUsers.length).toFixed(1) 
    : '0';
  const avgCredentials = interactedUsers.length > 0 
    ? (interactedUsers.reduce((sum, u) => sum + u.actions.typed_credentials, 0) / interactedUsers.length).toFixed(1) 
    : '0';
  const avgReported = interactedUsers.length > 0 
    ? (interactedUsers.reduce((sum, u) => sum + u.actions.reported, 0) / interactedUsers.length).toFixed(1) 
    : '0';
  const avgBlocked = interactedUsers.length > 0 
    ? (interactedUsers.reduce((sum, u) => sum + u.actions.blocked, 0) / interactedUsers.length).toFixed(1) 
    : '0';

  const totalClicked = users.reduce((sum, u) => sum + u.actions.clicked_link, 0);
  const totalCredentials = users.reduce((sum, u) => sum + u.actions.typed_credentials, 0);
  const totalReported = users.reduce((sum, u) => sum + u.actions.reported, 0);
  const totalBlocked = users.reduce((sum, u) => sum + u.actions.blocked, 0);

  // Risk distribution
  const riskDistribution = [
    { name: 'Low Risk', value: users.filter(u => u.riskLevel === 'low').length, fill: 'hsl(var(--success))' },
    { name: 'Medium Risk', value: users.filter(u => u.riskLevel === 'medium').length, fill: 'hsl(var(--warning))' },
    { name: 'High Risk', value: users.filter(u => u.riskLevel === 'high').length, fill: 'hsl(var(--destructive))' },
  ];

  // User comparison chart - sorted by score
  const userComparisonData = [...users]
    .sort((a, b) => b.score - a.score)
    .map(u => ({
      name: u.email.split('@')[0].substring(0, 10),
      score: u.score,
      clicked: u.actions.clicked_link,
      credentials: u.actions.typed_credentials,
      reported: u.actions.reported,
      blocked: u.actions.blocked,
    }));

  // Radar chart for averages
  const radarData = [
    { subject: 'Links Clicked', A: parseFloat(avgClicked), fullMark: 10 },
    { subject: 'Credentials Entered', A: parseFloat(avgCredentials), fullMark: 5 },
    { subject: 'Reported', A: parseFloat(avgReported), fullMark: 20 },
    { subject: 'Blocked', A: parseFloat(avgBlocked), fullMark: 20 },
  ];

  // Action totals for pie chart
  const actionTotals = [
    { name: 'Clicked Links', value: totalClicked, fill: 'hsl(var(--warning))' },
    { name: 'Credentials', value: totalCredentials, fill: 'hsl(var(--destructive))' },
    { name: 'Reported', value: totalReported, fill: 'hsl(var(--success))' },
    { name: 'Blocked', value: totalBlocked, fill: 'hsl(var(--primary))' },
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 px-4 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <BarChart3 className="h-8 w-8 text-primary" />
                Analytics Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">Comprehensive statistics and user comparisons</p>
            </div>
            <Button variant="outline" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{users.length}</div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Avg Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold gradient-text">{avgScore}</div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Avg Clicked</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-warning">{avgClicked}</div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Avg Reported</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-success">{avgReported}</div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Avg Blocked</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{avgBlocked}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row 1 */}
              <div className="grid lg:grid-cols-3 gap-6 mb-8">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Risk Distribution</CardTitle>
                    <CardDescription>Users by risk level</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={riskDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${value}`}
                        >
                          {riskDistribution.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Action Totals</CardTitle>
                    <CardDescription>All user actions combined</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {actionTotals.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={actionTotals}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            dataKey="value"
                            label
                          >
                            {actionTotals.map((entry, index) => (
                              <Cell key={index} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                        No actions recorded yet
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Average Behavior Pattern</CardTitle>
                    <CardDescription>Radar view of average actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} />
                        <Radar name="Average" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* All Users Comparison */}
              <Card className="glass-card mb-8">
                <CardHeader>
                  <CardTitle>All Users Comparison - Scores</CardTitle>
                  <CardDescription>Compare security awareness scores across all users (sorted by score)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={userComparisonData} margin={{ bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis 
                        dataKey="name" 
                        angle={-45} 
                        textAnchor="end" 
                        height={80}
                        interval={0}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="score" name="Score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* All Users Comparison - Actions */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>All Users Comparison - Actions</CardTitle>
                  <CardDescription>Compare action counts across all users</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={userComparisonData} margin={{ bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis 
                        dataKey="name" 
                        angle={-45} 
                        textAnchor="end" 
                        height={80}
                        interval={0}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="clicked" name="Clicked Links" fill="hsl(var(--warning))" stackId="stack" />
                      <Bar dataKey="credentials" name="Credentials" fill="hsl(var(--destructive))" stackId="stack" />
                      <Bar dataKey="reported" name="Reported" fill="hsl(var(--success))" stackId="stack" />
                      <Bar dataKey="blocked" name="Blocked" fill="hsl(var(--primary))" stackId="stack" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
