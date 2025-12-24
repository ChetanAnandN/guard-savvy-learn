import { Link } from 'react-router-dom';
import { Shield, ArrowRight, Mail, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';

export default function Landing() {
  const features = [
    {
      icon: Mail,
      title: 'Simulated Inbox',
      description: 'Practice identifying phishing emails in a realistic Gmail-like environment',
    },
    {
      icon: AlertTriangle,
      title: 'Risk Detection',
      description: 'Learn to spot suspicious indicators like spoofed domains and urgency tactics',
    },
    {
      icon: CheckCircle,
      title: 'Safe Training',
      description: 'Experience phishing attempts safely with educational feedback',
    },
    {
      icon: BarChart3,
      title: 'Progress Tracking',
      description: 'Monitor your awareness score and improvement over time',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in">
            <Shield className="h-4 w-4" />
            Cybersecurity Awareness Platform
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-slide-up">
            Learn to Identify
            <br />
            <span className="gradient-text">Phishing Attacks</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            PhishGuard is an interactive platform that trains students to recognize 
            and report phishing attempts through realistic email simulations.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link to="/auth">
              <Button size="lg" className="btn-gradient text-lg px-8 py-6 gap-2">
                Start Training
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Instructor Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How PhishGuard Works
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Our platform uses realistic simulations to teach you how to identify 
              and respond to phishing threats safely.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="glass-card p-6 card-hover animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 shadow-glow">
                  <feature.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="glass-card p-8 md:p-12 rounded-2xl">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">91%</div>
                <p className="text-muted-foreground">of cyberattacks start with phishing</p>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">$4.91M</div>
                <p className="text-muted-foreground">average cost of a data breach</p>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">3x</div>
                <p className="text-muted-foreground">more attacks during academic periods</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-hero">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-6">
            Ready to Become Phishing-Proof?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8">
            Join thousands of students learning to protect themselves and their organizations from cyber threats.
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-background text-foreground hover:bg-background/90 text-lg px-8 py-6">
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">PhishGuard</span>
          </div>
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} PhishGuard • Cybersecurity Awareness Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
