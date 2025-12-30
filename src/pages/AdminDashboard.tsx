import { useState, useEffect } from 'react';
import { Users, Mail, AlertTriangle, TrendingUp, UserPlus, Trash2, Loader2, Shield, RefreshCw, Key, Lock } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface UserWithPerformance {
  id: string;
  email: string;
  role: string;
  verified: boolean;
  has_password: boolean;
  created_at: string;
  score: number;
  risk_level: string;
  total_phishing_clicked: number;
  total_phishing_reported: number;
  total_safe_opened: number;
  action_counts: {
    opened: number;
    clicked_link: number;
    typed_credentials: number;
    reported: number;
    deleted: number;
  };
  has_interacted: boolean;
  risk_comment: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'student' | 'instructor'>('student');
  const [deleteEmail, setDeleteEmail] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  
  // Password update state
  const [passwordDialogUser, setPasswordDialogUser] = useState<string | null>(null);
  const [updatePassword, setUpdatePassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'list', adminEmail: user?.email },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setUsers(data.users || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error loading users',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast({ title: 'Invalid email', variant: 'destructive' });
      return;
    }

    if (newPassword && newPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setIsAddingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { 
          action: 'add', 
          adminEmail: user?.email, 
          targetEmail: newEmail, 
          targetRole: newRole,
          targetPassword: newPassword || undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({ title: 'User added successfully', description: newPassword ? 'User can login immediately' : 'User needs to register with OTP' });
      setNewEmail('');
      setNewPassword('');
      setNewRole('student');
      setAddDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Failed to add user', description: error.message, variant: 'destructive' });
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!passwordDialogUser) return;
    
    if (updatePassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { 
          action: 'update-password', 
          adminEmail: user?.email, 
          targetEmail: passwordDialogUser,
          targetPassword: updatePassword,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({ title: 'Password updated successfully' });
      setPasswordDialogUser(null);
      setUpdatePassword('');
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Failed to update password', description: error.message, variant: 'destructive' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleRemoveUser = async (email: string) => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'remove', adminEmail: user?.email, targetEmail: email },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({ title: 'User removed successfully' });
      setDeleteEmail(null);
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Failed to remove user', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const stats = {
    totalUsers: users.length,
    students: users.filter(u => u.role === 'student').length,
    highRisk: users.filter(u => u.risk_level === 'high').length,
    interacted: users.filter(u => u.has_interacted).length,
  };

  const actionData = [
    { name: 'Safe Actions', value: users.reduce((acc, u) => acc + u.action_counts.reported + u.action_counts.deleted, 0), fill: 'hsl(var(--success))' },
    { name: 'Risky Actions', value: users.reduce((acc, u) => acc + u.action_counts.clicked_link + u.action_counts.typed_credentials, 0), fill: 'hsl(var(--destructive))' },
  ];

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 px-4 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Shield className="h-8 w-8 text-primary" />
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">Manage users and monitor performance</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchUsers} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-gradient">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>Add a user to the PhishGuard platform. Set a password so they can login immediately, or leave blank to require OTP registration.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium">Email *</label>
                      <Input
                        placeholder="user@example.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Password (optional)</label>
                      <Input
                        type="password"
                        placeholder="Min 6 characters (leave blank for OTP registration)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">If set, user can login immediately without OTP</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Role</label>
                      <Select value={newRole} onValueChange={(v: 'student' | 'instructor') => setNewRole(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="instructor">Instructor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddUser} disabled={isAddingUser}>
                      {isAddingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add User'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" /> Total Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalUsers}</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{stats.students}</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> High Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">{stats.highRisk}</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Interacted
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">{stats.interacted}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Pie Chart */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Actions Overview</CardTitle>
                <CardDescription>Safe vs risky user behaviors</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={actionData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label>
                      {actionData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-success" />
                    <span className="text-sm">Safe</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive" />
                    <span className="text-sm">Risky</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="glass-card lg:col-span-2">
              <CardHeader>
                <CardTitle>Platform Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Total Phishing Clicks</p>
                    <p className="text-2xl font-bold text-destructive">
                      {users.reduce((acc, u) => acc + u.total_phishing_clicked, 0)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Total Reports</p>
                    <p className="text-2xl font-bold text-success">
                      {users.reduce((acc, u) => acc + u.total_phishing_reported, 0)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Credentials Entered</p>
                    <p className="text-2xl font-bold text-warning">
                      {users.reduce((acc, u) => acc + u.action_counts.typed_credentials, 0)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Average Score</p>
                    <p className="text-2xl font-bold">
                      {users.length > 0 ? Math.round(users.reduce((acc, u) => acc + u.score, 0) / users.length) : 100}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>Performance and risk assessment for each user. Click the key icon to set/update passwords.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No users found. Add users to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Email</th>
                        <th className="text-left py-3 px-4 font-medium">Role</th>
                        <th className="text-left py-3 px-4 font-medium">Score</th>
                        <th className="text-left py-3 px-4 font-medium">Risk Level</th>
                        <th className="text-left py-3 px-4 font-medium">Risk Comment</th>
                        <th className="text-left py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{u.email}</span>
                              {u.has_password ? (
                                <Badge variant="outline" className="text-xs gap-1"><Lock className="h-3 w-3" /> Password</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">No Password</Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={u.role === 'instructor' ? 'default' : 'secondary'}>
                              {u.role}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`font-bold ${u.score >= 80 ? 'text-success' : u.score >= 50 ? 'text-warning' : 'text-destructive'}`}>
                              {u.score}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={getRiskBadgeVariant(u.risk_level)}>
                              {u.has_interacted ? u.risk_level : 'normal'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-muted-foreground">{u.risk_comment}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              {/* Set Password Button */}
                              <Dialog open={passwordDialogUser === u.email} onOpenChange={(open) => !open && setPasswordDialogUser(null)}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-primary hover:text-primary hover:bg-primary/10"
                                    onClick={() => setPasswordDialogUser(u.email)}
                                    title="Set/Update Password"
                                  >
                                    <Key className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Set Password</DialogTitle>
                                    <DialogDescription>
                                      Set a new password for <strong>{u.email}</strong>
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="py-4">
                                    <Input
                                      type="password"
                                      placeholder="New password (min 6 characters)"
                                      value={updatePassword}
                                      onChange={(e) => setUpdatePassword(e.target.value)}
                                    />
                                  </div>
                                  <DialogFooter>
                                    <Button variant="outline" onClick={() => { setPasswordDialogUser(null); setUpdatePassword(''); }}>Cancel</Button>
                                    <Button onClick={handleUpdatePassword} disabled={isUpdatingPassword}>
                                      {isUpdatingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set Password'}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>

                              {/* Delete Button */}
                              {u.email !== user?.email && (
                                <Dialog open={deleteEmail === u.email} onOpenChange={(open) => !open && setDeleteEmail(null)}>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => setDeleteEmail(u.email)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Remove User</DialogTitle>
                                      <DialogDescription>
                                        Are you sure you want to remove <strong>{u.email}</strong>? This will delete all their data.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                      <Button variant="outline" onClick={() => setDeleteEmail(null)}>Cancel</Button>
                                      <Button variant="destructive" onClick={() => handleRemoveUser(u.email)} disabled={isDeleting}>
                                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove'}
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
