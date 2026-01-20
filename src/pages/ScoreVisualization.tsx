import { useState, useEffect } from 'react';
import { Shield, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Mail, MousePointer, KeyRound, Flag } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { SCORING_WEIGHTS, calculateScore, getScoreBreakdown, getRiskLevel, getRiskComment, ActionCounts } from '@/lib/scoring';

export default function ScoreVisualization() {
  const { user } = useAuth();
  const [actions, setActions] = useState<ActionCounts>({
    opened: 0,
    clicked_link: 0,
    typed_credentials: 0,
    reported: 0,
    deleted: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchActions();
    }
  }, [user]);

  const fetchActions = async () => {
    setIsLoading(true);
    try {
      const { data: actionsData } = await supabase
        .from('user_actions')
        .select('action')
        .eq('user_id', user?.id);

      if (actionsData) {
        const counts: ActionCounts = {
          opened: 0,
          clicked_link: 0,
          typed_credentials: 0,
          reported: 0,
          deleted: 0,
        };
        
        actionsData.forEach((a) => {
          if (a.action in counts) {
            counts[a.action as keyof ActionCounts]++;
          }
        });
        
        setActions(counts);
      }
    } catch (error) {
      console.error('Error fetching actions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const breakdown = getScoreBreakdown(actions);
  const score = breakdown.finalScore;
  const riskLevel = getRiskLevel(score);
  const hasInteracted = actions.opened + actions.clicked_link + actions.typed_credentials + actions.reported > 0;
  const riskComment = getRiskComment(score, hasInteracted);

  const formulaData = [
    { name: 'Base Score', value: breakdown.baseScore, fill: 'hsl(var(--primary))' },
    { name: 'Opened Penalty', value: breakdown.openedPenalty, fill: 'hsl(var(--warning))' },
    { name: 'Clicked Penalty', value: breakdown.clickedPenalty, fill: 'hsl(var(--destructive))' },
    { name: 'Credentials Penalty', value: breakdown.credentialsPenalty, fill: 'hsl(var(--destructive))' },
    { name: 'Reported Bonus', value: breakdown.reportedBonus, fill: 'hsl(var(--success))' },
  ];

  const actionBreakdown = [
    { name: 'Opened', count: actions.opened, weight: SCORING_WEIGHTS.Wo, impact: -SCORING_WEIGHTS.Wo * actions.opened, icon: Mail, color: 'text-warning' },
    { name: 'Clicked Links', count: actions.clicked_link, weight: SCORING_WEIGHTS.Wc, impact: -SCORING_WEIGHTS.Wc * actions.clicked_link, icon: MousePointer, color: 'text-destructive' },
    { name: 'Entered Credentials', count: actions.typed_credentials, weight: SCORING_WEIGHTS.Wd, impact: -SCORING_WEIGHTS.Wd * actions.typed_credentials, icon: KeyRound, color: 'text-destructive' },
    { name: 'Reported', count: actions.reported, weight: SCORING_WEIGHTS.Wr, impact: SCORING_WEIGHTS.Wr * actions.reported, icon: Flag, color: 'text-success' },
  ];

  const getRiskColor = () => {
    switch (riskLevel) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-warning';
      default: return 'text-success';
    }
  };

  const pieData = [
    { name: 'Good Actions', value: actions.reported + actions.deleted, fill: 'hsl(var(--success))' },
    { name: 'Risky Actions', value: actions.clicked_link + actions.typed_credentials, fill: 'hsl(var(--destructive))' },
    { name: 'Neutral', value: actions.opened, fill: 'hsl(var(--muted-foreground))' },
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 px-4 pb-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" /> Score Visualization
          </h1>
          <p className="text-muted-foreground mb-8">Understand how your security awareness score is calculated</p>

          {/* Score Overview */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="glass-card md:col-span-2">
              <CardHeader>
                <CardTitle>Your Security Score</CardTitle>
                <CardDescription>Based on the formula: S = Sbase - (Wo×O) - (Wc×C) - (Wd×D) + (Wr×R)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <div className="text-6xl font-bold gradient-text">{score}</div>
                    <p className="text-muted-foreground mt-1">out of 100</p>
                  </div>
                  <div className="flex-1">
                    <Progress value={score} className="h-4 mb-4" />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>0 (Critical)</span>
                      <span>50 (Base)</span>
                      <span>100 (Excellent)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Risk Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold capitalize mb-2 ${getRiskColor()}`}>
                  {riskLevel} Risk
                </div>
                <p className="text-sm text-muted-foreground">{riskComment}</p>
              </CardContent>
            </Card>
          </div>

          {/* Formula Breakdown */}
          <Card className="glass-card mb-8">
            <CardHeader>
              <CardTitle>Formula Breakdown</CardTitle>
              <CardDescription>
                S = {SCORING_WEIGHTS.Sbase} - ({SCORING_WEIGHTS.Wo}×O) - ({SCORING_WEIGHTS.Wc}×C) - ({SCORING_WEIGHTS.Wd}×D) + ({SCORING_WEIGHTS.Wr}×R)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Component</th>
                      <th className="text-left py-3 px-4">Weight</th>
                      <th className="text-left py-3 px-4">Your Count</th>
                      <th className="text-left py-3 px-4">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3 px-4 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Base Score (Sbase)
                      </td>
                      <td className="py-3 px-4">+{SCORING_WEIGHTS.Sbase}</td>
                      <td className="py-3 px-4">-</td>
                      <td className="py-3 px-4 text-primary font-medium">+{SCORING_WEIGHTS.Sbase}</td>
                    </tr>
                    {actionBreakdown.map((action) => (
                      <tr key={action.name} className="border-b">
                        <td className="py-3 px-4 flex items-center gap-2">
                          <action.icon className={`h-4 w-4 ${action.color}`} />
                          {action.name} ({action.name === 'Reported' ? 'R' : action.name === 'Opened' ? 'O' : action.name === 'Clicked Links' ? 'C' : 'D'})
                        </td>
                        <td className="py-3 px-4">{action.name === 'Reported' ? '+' : '-'}{action.weight}</td>
                        <td className="py-3 px-4">{action.count}</td>
                        <td className={`py-3 px-4 font-medium ${action.impact > 0 ? 'text-success' : action.impact < 0 ? 'text-destructive' : ''}`}>
                          {action.impact > 0 ? '+' : ''}{action.impact}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30">
                      <td className="py-3 px-4 font-bold" colSpan={3}>Final Score</td>
                      <td className="py-3 px-4 font-bold text-lg gradient-text">{score}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Score Components</CardTitle>
                <CardDescription>Visual breakdown of score calculation</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={formulaData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {formulaData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Action Distribution</CardTitle>
                <CardDescription>Your behavior categorized</CardDescription>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <div className="text-center">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No actions recorded yet</p>
                      <p className="text-sm">Interact with emails to see your distribution</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
