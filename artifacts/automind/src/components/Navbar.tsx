import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

export function Navbar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/recommend", label: "Smart Recommendations" },
    { href: "/compare", label: "Compare" },
    { href: "/insights", label: "Smart Insights" },
    { href: "/news", label: "Car News" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[hsl(220,20%,5%/0.95)] backdrop-blur-md border-b border-[hsl(220,15%,15%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/">
            <motion.div
              className="flex items-center gap-2 cursor-pointer"
              whileHover={{ scale: 1.02 }}
            >
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
                <span className="text-white font-bold text-sm">AM</span>
              </div>
              <span className="font-bold text-xl text-foreground tracking-tight">
                Auto<span className="text-primary">Mind</span>
              </span>
            </motion.div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <motion.span
                  className={`px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors ${
                    location === link.href
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {link.label}
                </motion.span>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground hidden sm:block">
                  Welcome, <span className="text-foreground font-medium">{user.name.split(" ")[0]}</span>
                </span>
                <motion.button
                  onClick={logout}
                  className="px-3 py-1.5 rounded border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Logout
                </motion.button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <motion.span
                    className="px-3 py-1.5 rounded text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                    whileHover={{ scale: 1.03 }}
                  >
                    Login
                  </motion.span>
                </Link>
                <Link href="/register">
                  <motion.span
                    className="px-3 py-1.5 rounded bg-primary text-white text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Register
                  </motion.span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
