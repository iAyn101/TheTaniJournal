import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { ArrowRight, Feather, Lock, Users } from "lucide-react";

const heroImg = "https://images.unsplash.com/photo-1579017308347-e53e0d2fc5e9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwyfHx3cml0aW5nJTIwam91cm5hbCUyMGFlc3RoZXRpY3xlbnwwfHx8fDE3ODI3NTc2Nzh8MA&ixlib=rb-4.1.0&q=85";

export default function Landing() {
  return (
    <div className="min-h-screen paper-bg">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 lg:px-8">
        <section className="grid lg:grid-cols-12 gap-12 py-16 lg:py-24 items-center">
          <div className="lg:col-span-7 animate-fade-up">
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-8">A quiet place for slow writing</div>
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight mb-8">
              Write your days,<br />
              <span className="italic text-stone-500">your way.</span>
            </h1>
            <p className="text-lg leading-relaxed text-stone-600 dark:text-stone-400 max-w-xl mb-10">
              The Tani Journal is a calm, distraction-free home for your private musings and public essays —
              with a community of writers, when you want one.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/auth">
                <Button size="lg" className="rounded-md px-6" data-testid="cta-start">
                  Start writing <ArrowRight className="ml-2 h-4 w-4" strokeWidth={1.5} />
                </Button>
              </Link>
              <Link to="/discover">
                <Button size="lg" variant="outline" className="rounded-md px-6 border-stone-300 dark:border-stone-700" data-testid="cta-discover">
                  Explore journals
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-8 mt-16 pt-10 border-t border-stone-200 dark:border-stone-800">
              {[
                { icon: Feather, h: "Rich editor", p: "Headings, links, images." },
                { icon: Lock, h: "Private by default", p: "Public when you want." },
                { icon: Users, h: "Live presence", p: "See who's writing now." },
              ].map((f, i) => (
                <div key={i}>
                  <f.icon className="h-5 w-5 mb-3 text-stone-500" strokeWidth={1.5} />
                  <div className="font-medium text-sm mb-1">{f.h}</div>
                  <div className="text-xs text-stone-500">{f.p}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <div className="relative">
              <img src={heroImg} alt="Writing" className="rounded-md w-full aspect-[4/5] object-cover" />
              <div className="absolute -bottom-6 -left-6 hidden md:block bg-card border border-stone-200 dark:border-stone-800 rounded-md p-5 max-w-xs">
                <div className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2">Today</div>
                <p className="font-serif text-xl leading-snug">&ldquo;I notice the moon arrived early tonight…&rdquo;</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="py-12 text-center text-xs uppercase tracking-[0.3em] text-stone-500 border-t border-stone-200 dark:border-stone-800">
          The Tani Journal · slow writing for ordinary days
        </footer>
      </main>
    </div>
  );
}
