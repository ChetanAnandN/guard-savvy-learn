import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type AuthStep = 'email' | 'otp';

export default function Auth() {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { email },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send OTP');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'OTP Sent!',
        description: 'Check your email for the 6-digit code.',
      });
      setStep('otp');
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast({
        title: 'Failed to send OTP',
        description: error.message || 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Please enter the complete 6-digit code.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { email, otp },
      });

      if (error) throw error;

      if (data.success && data.user) {
        login(data.user, data.token);
        toast({
          title: 'Welcome to PhishGuard!',
          description: 'You have successfully signed in.',
        });
        
        // Redirect based on role
        if (data.user.role === 'instructor') {
          navigate('/dashboard-admin');
        } else {
          navigate('/dashboard-student');
        }
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      toast({
        title: 'Verification failed',
        description: error.message || 'Invalid or expired code.',
        variant: 'destructive',
      });
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
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-primary mx-auto flex items-center justify-center shadow-glow mb-4">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Welcome to PhishGuard</h1>
            <p className="text-muted-foreground">
              {step === 'email' 
                ? 'Enter your email to receive a login code' 
                : 'Enter the 6-digit code sent to your email'}
            </p>
          </div>

          {step === 'email' ? (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="your.email@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 text-lg"
                  disabled={isLoading}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-12 btn-gradient text-lg gap-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Send Login Code
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={isLoading}
                >
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

              <Button 
                onClick={handleVerifyOTP}
                className="w-full h-12 btn-gradient text-lg gap-2"
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <KeyRound className="h-5 w-5" />
                    Verify Code
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtp('');
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                >
                  Use a different email
                </button>
              </div>
            </div>
          )}

          {/* Footer note */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
