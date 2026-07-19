import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { registrationApi } from "../../features/registration/registrationApi";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { CheckIcon, StethoscopeIcon, CalendarIcon, CreditCardIcon, ChartIcon } from "../../components/icons";
import { formatCurrency } from "../../utils/format";

const FEATURES = [
  { icon: CalendarIcon, title: "Appointments & Token Queue", desc: "Walk-in tokens, doctor slots, and a live queue board." },
  { icon: StethoscopeIcon, title: "Clinical Workflow", desc: "Vitals, consultations, prescriptions, and lab orders." },
  { icon: CreditCardIcon, title: "Billing & Receipts", desc: "Invoices, payments, and printable thermal receipts." },
  { icon: ChartIcon, title: "Reports & Analytics", desc: "Revenue, workload, and patient trends at a glance." },
];

export function LandingPage() {
  const reduce = useReducedMotion();
  const { data: plans } = useQuery({ queryKey: ["public", "plans"], queryFn: registrationApi.publicPlans });

  return (
    <div className="min-h-svh bg-gradient-to-b from-primary-50 via-white to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-sm font-bold text-white">C</div>
          <span className="text-lg font-semibold text-slate-900">ClinicOS</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link to="/register">
            <Button>Register your clinic</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 text-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Badge tone="primary" className="mb-4">
            Multi-tenant clinic management
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Run your clinic on one calm, modern platform
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
            Patients, appointments, consultations, prescriptions, billing, and reports — built for busy South-Asian
            clinics with token queues, MR numbers, and deserving-patient categories.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/register">
              <Button size="lg">Get started free</Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="secondary">
                Sign in
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="text-center text-2xl font-bold text-slate-900">Simple, transparent pricing</h2>
        <p className="mt-2 text-center text-slate-500">Choose a plan that fits your practice. Upgrade anytime.</p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {(plans ?? []).map((plan, i) => (
            <motion.div
              key={plan.planId}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className={`flex flex-col rounded-2xl border bg-white p-6 shadow-soft ${
                i === 1 ? "border-primary-300 ring-1 ring-primary-200" : "border-slate-100"
              }`}
            >
              {i === 1 && <Badge tone="primary" className="mb-3 self-start">Most popular</Badge>}
              <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {formatCurrency(plan.priceMonthly)}
                <span className="text-base font-normal text-slate-400">/mo</span>
              </p>
              <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckIcon className="h-4 w-4 text-success-600" />
                  {plan.maxUsers ? `${plan.maxUsers} users` : "Unlimited users"}
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="h-4 w-4 text-success-600" />
                  {plan.maxPatients ? `${plan.maxPatients.toLocaleString()} patients` : "Unlimited patients"}
                </li>
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-success-600" />
                    <span className="capitalize">{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/register" className="mt-6">
                <Button variant={i === 1 ? "primary" : "secondary"} className="w-full">
                  Get started
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} ClinicOS. Built for modern clinics.
      </footer>
    </div>
  );
}
