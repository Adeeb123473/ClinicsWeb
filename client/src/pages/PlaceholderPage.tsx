import { motion, useReducedMotion } from "framer-motion";
import { EmptyState } from "../components/EmptyState";

export interface PlaceholderPageProps {
  title: string;
  message: string;
}

/** Empty-shell page: a heading plus an EmptyState explaining what's coming later. */
export function PlaceholderPage({ title, message }: PlaceholderPageProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <EmptyState title={message} description="This module is on the roadmap and isn't wired up yet." />
    </motion.div>
  );
}
