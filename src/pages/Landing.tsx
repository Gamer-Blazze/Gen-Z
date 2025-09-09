import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { 
  MessageCircle, 
  Users, 
  Heart, 
  Globe, 
  Mountain, 
  ArrowRight,
  Star,
  Shield,
  Zap
} from "lucide-react";

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const features = [
    {
      icon: MessageCircle,
      title: "Real-time Messaging",
      description: "Connect instantly with friends and family across Nepal"
    },
    {
      icon: Users,
      title: "Community Groups",
      description: "Join communities based on your interests and location"
    },
    {
      icon: Heart,
      title: "Share Moments",
      description: "Share your daily life, festivals, and special moments"
    },
    {
      icon: Globe,
      title: "Discover Nepal",
      description: "Explore different regions and cultures of Nepal"
    },
    {
      icon: Mountain,
      title: "Local Events",
      description: "Stay updated with local events and celebrations"
    },
    {
      icon: Shield,
      title: "Safe & Secure",
      description: "Your privacy and security are our top priority"
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-red-950/20 dark:via-background dark:to-orange-950/20"
    >
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-background/80 backdrop-blur-md border-b border-red-200/50 dark:border-red-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div 
              className="flex items-center gap-2 cursor-pointer"
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate("/")}
            >
              <img src="/logo.svg" alt="Nepal Social" className="w-8 h-8" />
              <span className="font-bold text-xl bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                Nepal Social
              </span>
            </motion.div>
            
            <div className="flex items-center gap-4">
              {!isLoading && (
                <>
                  {isAuthenticated ? (
                    <Button 
                      onClick={() => navigate("/dashboard")}
                      className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                    >
                      Dashboard
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => navigate("/auth")}
                      className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                    >
                      Gen-z Nepal
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <div className="inline-flex items-center gap-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Star className="w-4 h-4" />
                Gen-z Nepal
              </div>
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
                <span className="bg-gradient-to-r from-red-600 via-orange-600 to-yellow-600 bg-clip-text text-transparent">
                  Nepal's Own
                </span>
                <br />
                <span className="text-foreground">Social Network</span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
                Connect with friends, share your culture, and discover the beauty of Nepal. 
                Join the largest social community built for Nepali people worldwide.
              </p>
            </motion.div>

            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
            >
              {!isLoading && (
                <>
                  {isAuthenticated ? (
                    <Button 
                      size="lg"
                      onClick={() => navigate("/dashboard")}
                      className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-lg px-8 py-6"
                    >
                      Go to Dashboard
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  ) : (
                    <>
                      <Button 
                        size="lg"
                        onClick={() => navigate("/auth")}
                        className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-lg px-8 py-6"
                      >
                        Gen-z Nepal
                        <ArrowRight className="ml-2 w-5 h-5" />
                      </Button>
                      <Button 
                        size="lg"
                        variant="outline"
                        className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20 text-lg px-8 py-6"
                      >
                        Learn More
                      </Button>
                    </>
                  )}
                </>
              )}
            </motion.div>

            {/* Hero Image/Illustration */}
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="relative"
            >
              {/* Added: Featured image from user */}
              <div className="max-w-3xl mx-auto mb-8">
                <img
                  src="https://harmless-tapir-303.convex.cloud/api/storage/d9582a69-d7a2-4344-b33d-a0ce024b8514"
                  alt="Gen-z Nepal"
                  loading="lazy"
                  className="w-full rounded-2xl shadow-lg border border-red-200/50 dark:border-red-800/50"
                />
              </div>
              <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-3xl p-8 backdrop-blur-sm border border-red-200/50 dark:border-red-800/50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="border-red-200/50 dark:border-red-800/50">
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageCircle className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="font-semibold mb-2">Instant Messaging</h3>
                      <p className="text-sm text-muted-foreground">Chat with friends in real-time</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-red-200/50 dark:border-red-800/50">
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="font-semibold mb-2">Communities</h3>
                      <p className="text-sm text-muted-foreground">Join local groups and events</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-red-200/50 dark:border-red-800/50">
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Heart className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="font-semibold mb-2">Share Culture</h3>
                      <p className="text-sm text-muted-foreground">Celebrate Nepali traditions</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white/50 dark:bg-background/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Built for <span className="bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">Nepal</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience social networking designed specifically for Nepali culture and community
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Card className="h-full border-red-200/50 dark:border-red-800/50 hover:border-red-300 dark:hover:border-red-700 transition-colors">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-red-600 to-orange-600 rounded-3xl p-12 text-white text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-8">
              Join Thousands of Nepalis Worldwide
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="text-4xl font-bold mb-2">10K+</div>
                <div className="text-red-100">Active Users</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2">50K+</div>
                <div className="text-red-100">Messages Sent</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2">100+</div>
                <div className="text-red-100">Communities</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Connect with Nepal?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join Nepal Social today and become part of the largest Nepali community online
            </p>
            {!isLoading && !isAuthenticated && (
              <Button 
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-lg px-8 py-6"
              >
                <Zap className="mr-2 w-5 h-5" />
                Get Started Now
              </Button>
            )}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-red-200/50 dark:border-red-800/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <img src="/logo.svg" alt="Nepal Social" className="w-6 h-6" />
              <span className="font-semibold text-lg">Nepal Social</span>
            </div>
            <div className="text-sm text-muted-foreground">
              © 2025 Gen-Z Social Media. Made By Diva
            </div>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}