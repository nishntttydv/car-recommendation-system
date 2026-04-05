import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useRegisterUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Register() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const mutation = useRegisterUser({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user);
        navigate("/");
      },
      onError: (err: unknown) => {
        const e = err as { data?: { message?: string } };
        setError(e?.data?.message || "Registration failed. Please try again.");
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    mutation.mutate({ data: { name, email, password } });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-card border border-border rounded-xl p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-secondary font-black text-lg">AM</span>
            </div>
            <h1 className="text-2xl font-black text-foreground">Create Account</h1>
            <p className="text-muted-foreground text-sm mt-1">Join AutoMind for smart car discovery</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 text-sm"
                placeholder="Your Name"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 text-sm"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 text-sm"
                placeholder="Min 6 characters"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2 text-sm text-destructive"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-3 bg-secondary text-white font-bold rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {mutation.isPending ? "Creating account..." : "Create Account"}
            </motion.button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <a href="/login" className="text-primary hover:text-primary/80 transition-colors font-medium">
              Login
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
