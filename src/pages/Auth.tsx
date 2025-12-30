import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, ArrowRight, Loader2, KeyRound, Lock, UserPlus, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type RegisterStep = 'email' | 'otp' | 'password';

export default function Auth() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register state
  const [registerStep, setRegisterStep] = useState<RegisterStep>('email');
  const [registerEmail, setRegisterEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!loginEmail || !loginPassword) {
      setErrorMessage('Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('login', {
        body: { email: loginEmail, password: loginPassword },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      login(data.user, data.token);
      toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
      
      if (data.user.role === 'instructor') {
        navigate('/dashboard-admin');
      } else {
        navigate('/dashboard-student');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setErrorMessage(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Send OTP for Registration
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!registerEmail || !registerEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { email: registerEmail },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: 'OTP Sent!', description: 'Check your email for the 6-digit code.' });
      setRegisterStep('otp');
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      setErrorMessage(error.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOTP = () => {
    if (otp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit code');
      return;
    }
    setErrorMessage(null);
    setRegisterStep('password');
  };

  // Handle Registration with Password
  const handleRegister = async () => {
    setErrorMessage(null);

    if (registerPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    if (registerPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('register', {
        body: { email: registerEmail, otp, password: registerPassword },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      login(data.user, data.token);
      toast({ title: 'Welcome to PhishGuard!', description: 'Your account has been created.' });
      
      if (data.user.role === 'instructor') {
        navigate('/dashboard-admin');
      } else {
        navigate('/dashboard-student');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      setErrorMessage(error.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-scale-in">
        <div className="glass-card p-8 rounded-2xl shadow-xl">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-primary mx-auto flex items-center justify-center shadow-glow mb-4">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold">PhishGuard</h1>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'login' | 'register'); setErrorMessage(null); }}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" className="gap-2">
                <LogIn className="h-4 w-4" /> Login
              </TabsTrigger>
              <TabsTrigger value="register" className="gap-2">
                <UserPlus className="h-4 w-4" /> Register
              </TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                {errorMessage && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {errorMessage}
                  </div>
                )}
                
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={loginEmail}
                    onChange={(e) => { setLoginEmail(e.target.value); setErrorMessage(null); }}
                    className="pl-10 h-12"
                    disabled={isLoading}
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => { setLoginPassword(e.target.value); setErrorMessage(null); }}
                    className="pl-10 h-12"
                    disabled={isLoading}
                  />
                </div>

                <Button type="submit" className="w-full h-12 btn-gradient text-lg gap-2" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Sign In <ArrowRight className="h-5 w-5" /></>}
                </Button>
              </form>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-4">
                  {errorMessage}
                </div>
              )}

              {registerStep === 'email' && (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Enter your email to receive a verification code
                  </p>
                  
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={registerEmail}
                      onChange={(e) => { setRegisterEmail(e.target.value); setErrorMessage(null); }}
                      className="pl-10 h-12"
                      disabled={isLoading}
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 btn-gradient text-lg gap-2" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Send Verification Code <ArrowRight className="h-5 w-5" /></>}
                  </Button>
                </form>
              )}

              {registerStep === 'otp' && (
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground text-center">
                    Enter the 6-digit code sent to <strong>{registerEmail}</strong>
                  </p>
                  
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={isLoading}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="h-14 w-12 text-2xl" />
                        <InputOTPSlot index={1} className="h-14 w-12 text-2xl" />
                        <InputOTPSlot index={2} className="h-14 w-12 text-2xl" />
                        <InputOTPSlot index={3} className="h-14 w-12 text-2xl" />
                        <InputOTPSlot index={4} className="h-14 w-12 text-2xl" />
                        <InputOTPSlot index={5} className="h-14 w-12 text-2xl" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button onClick={handleVerifyOTP} className="w-full h-12 btn-gradient text-lg gap-2" disabled={isLoading || otp.length !== 6}>
                    <KeyRound className="h-5 w-5" /> Verify Code
                  </Button>

                  <button
                    type="button"
                    onClick={() => { setRegisterStep('email'); setOtp(''); }}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Use a different email
                  </button>
                </div>
              )}

              {registerStep === 'password' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Create a password for your account
                  </p>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Password (min 6 characters)"
                      value={registerPassword}
                      onChange={(e) => { setRegisterPassword(e.target.value); setErrorMessage(null); }}
                      className="pl-10 h-12"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setErrorMessage(null); }}
                      className="pl-10 h-12"
                      disabled={isLoading}
                    />
                  </div>

                  <Button onClick={handleRegister} className="w-full h-12 btn-gradient text-lg gap-2" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Create Account <ArrowRight className="h-5 w-5" /></>}
                  </Button>

                  <button
                    type="button"
                    onClick={() => { setRegisterStep('email'); setOtp(''); setRegisterPassword(''); setConfirmPassword(''); }}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Start over
                  </button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
