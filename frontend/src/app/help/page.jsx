'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  HelpCircle,
  Search,
  Phone,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Pill,
  Bell,
  Shield,
  CreditCard,
  User,
  MessageSquare,
  Star,
  BookOpen,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  FileText,
  Plus,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import SupportTicketForm from '@/components/forms/SupportTicketForm';

// ── Constants ────────────────────────────────────────────────────────────────

const FAQ_CATEGORIES = [
  {
    key: 'medications',
    label: 'Medications & Dosage',
    icon: Pill,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    articles: [
      {
        id: 'faq-1',
        question: 'How do I add a new medication?',
        answer: 'Go to the Medicine Cabinet page and tap the "+ Add Medicine" button. You can enter details manually or use the OCR scanner to scan your prescription label. Fill in the medication name, dosage, frequency, and any special instructions.',
      },
      {
        id: 'faq-2',
        question: 'How does the OCR prescription scanner work?',
        answer: 'The OCR scanner uses AI to read text from your prescription label or bottle. Simply take a clear photo, and the system will automatically extract the medication name, dosage, and instructions. You can review and edit the extracted information before saving.',
      },
      {
        id: 'faq-3',
        question: 'Can I track multiple medications at once?',
        answer: 'Yes! PillSync supports unlimited medications. Each medication has its own schedule, reminders, and adherence tracking. You can view all medications in the Medicine Cabinet and manage them individually.',
      },
      {
        id: 'faq-4',
        question: 'What do the stock alerts mean?',
        answer: 'When your medication stock drops below 7 days of supply, you\'ll see a "Low Stock" warning badge. This helps you refill your prescriptions on time. You can update stock counts on the Refill page.',
      },
    ],
  },
  {
    key: 'reminders',
    label: 'Reminders & Notifications',
    icon: Bell,
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
    articles: [
      {
        id: 'faq-5',
        question: 'How do I set up medication reminders?',
        answer: 'When you add a medication, you can set the frequency (once daily, twice daily, etc.) and preferred times. The system will automatically create reminders based on your schedule. You can also customize notification channels (Push, SMS, WhatsApp).',
      },
      {
        id: 'faq-6',
        question: 'Can I snooze a reminder?',
        answer: 'Yes! When a reminder appears, you can snooze it for 5, 10, 15, or 30 minutes. The reminder will reappear after the snooze period. You can also skip a dose and provide a reason.',
      },
      {
        id: 'faq-7',
        question: 'Why am I not receiving notifications?',
        answer: 'Check your notification settings in the app. Make sure push notifications are enabled in your phone settings. For SMS and WhatsApp notifications, verify your phone number is correct in your profile.',
      },
    ],
  },
  {
    key: 'account',
    label: 'Account & Profile',
    icon: User,
    color: 'text-tertiary',
    bgColor: 'bg-tertiary/10',
    articles: [
      {
        id: 'faq-8',
        question: 'How do I change my password?',
        answer: 'Go to your profile settings and select "Change Password." You\'ll need to enter your current password and then your new password twice for confirmation. You can also use the "Forgot Password" link on the login page.',
      },
      {
        id: 'faq-9',
        question: 'What are the different user roles?',
        answer: 'PillSync has three roles: Patient (manages their own medications), Caregiver (monitors patients\' adherence and receives alerts), and Admin (manages system settings and users). You select your role during registration.',
      },
      {
        id: 'faq-10',
        question: 'How do I link a caregiver to my account?',
        answer: 'In the Caregiver Dashboard, use the "Link Patient" feature and enter the patient\'s unique code. The patient can find their code in their profile settings under "Caregiver Access."',
      },
    ],
  },
  {
    key: 'adherence',
    label: 'Adherence & Reports',
    icon: Star,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    articles: [
      {
        id: 'faq-11',
        question: 'How is adherence percentage calculated?',
        answer: 'Adherence is calculated as (Doses Taken ÷ Total Scheduled Doses) × 100. Snoozed doses that are eventually taken count as taken. Skipped doses count as missed for the calculation.',
      },
      {
        id: 'faq-12',
        question: 'Can I export my adherence report?',
        answer: 'Yes, you can view your adherence reports for 7-day, 30-day, or 90-day periods. The reports include per-medication breakdowns and dose history logs that you can share with your healthcare provider.',
      },
    ],
  },
  {
    key: 'privacy',
    label: 'Privacy & Security',
    icon: Shield,
    color: 'text-on-surface-variant',
    bgColor: 'bg-surface-container',
    articles: [
      {
        id: 'faq-13',
        question: 'Is my medical data secure?',
        answer: 'Yes. PillSync uses industry-standard encryption (AES-256) for data at rest and TLS 1.3 for data in transit. Your health data is stored on secured cloud servers with strict access controls. We never sell or share your data with third parties.',
      },
      {
        id: 'faq-14',
        question: 'Can I delete my account and data?',
        answer: 'Yes. Go to Profile Settings → Delete Account. This permanently removes all your data including medications, reminders, and adherence history. This action cannot be undone.',
      },
    ],
  },
];

const TICKET_STATUSES = {
  open:        { label: 'Open',        variant: 'snoozed',  Icon: Clock },
  in_progress: { label: 'In Progress', variant: 'primary',  Icon: Loader2 },
  resolved:    { label: 'Resolved',    variant: 'taken',    Icon: CheckCircle2 },
  closed:      { label: 'Closed',      variant: 'missed',   Icon: XCircle },
};

// ── Inner Page Component ─────────────────────────────────────────────────────

function HelpPageInner() {
  const { addToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedArticle, setExpandedArticle] = useState(null);
  const [activeTab, setActiveTab] = useState('faq'); // 'faq' | 'tickets' | 'new-ticket'
  const [tickets, setTickets] = useState([]);

  // ── Feedback state ──────────────────────────────────────────────
  const [feedbackGiven, setFeedbackGiven] = useState({});

  // ── Search Filter ───────────────────────────────────────────────
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return FAQ_CATEGORIES;

    const q = searchQuery.toLowerCase();
    return FAQ_CATEGORIES.map((cat) => ({
      ...cat,
      articles: cat.articles.filter(
        (a) =>
          a.question.toLowerCase().includes(q) ||
          a.answer.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.articles.length > 0);
  }, [searchQuery]);

  const totalResults = filteredCategories.reduce((sum, cat) => sum + cat.articles.length, 0);

  const toggleCategory = (key) => {
    setExpandedCategory((prev) => (prev === key ? null : key));
  };

  const toggleArticle = (id) => {
    setExpandedArticle((prev) => (prev === id ? null : id));
  };

  const handleFeedback = (articleId, helpful) => {
    setFeedbackGiven((prev) => ({ ...prev, [articleId]: helpful }));
    addToast({
      title: helpful ? 'Thanks for your feedback!' : 'We\'ll improve this',
      description: helpful ? 'Glad this article helped.' : 'We\'ll work on making this answer more helpful.',
      variant: helpful ? 'success' : 'default',
    });
  };

  const handleTicketSuccess = (ticket) => {
    const newTicket = {
      id: `TKT-2026-${String(tickets.length + 1).padStart(3, '0')}`,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority || 'medium',
      status: 'open',
      created: new Date().toISOString().split('T')[0],
      updated: new Date().toISOString().split('T')[0],
    };
    setTickets((prev) => [newTicket, ...prev]);
    setActiveTab('tickets');
    addToast({
      title: 'Ticket Created',
      description: `Ticket ${newTicket.id} has been submitted successfully.`,
      variant: 'success',
    });
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        {/* ── Emergency Disclaimer Banner ───────────────────────────── */}
        <div className="bg-[#EF4444] text-white">
          <div className="max-w-4xl mx-auto px-gutter py-sm">
            <div className="flex items-center justify-between gap-sm">
              <div className="flex items-center gap-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-pulse" />
                <p className="text-body-sm font-semibold">
                  <span className="hidden sm:inline">Medical Emergency? </span>
                  This app is NOT a substitute for professional medical advice.
                </p>
              </div>
              <a
                href="tel:108"
                className="flex items-center gap-1 px-md py-xs rounded-full bg-white/20 hover:bg-white/30 text-white font-bold text-body-sm transition-colors flex-shrink-0"
              >
                <Phone className="w-4 h-4" />
                Call 108
              </a>
            </div>
          </div>
        </div>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="bg-gradient-primary text-on-primary">
          <div className="max-w-4xl mx-auto px-gutter py-lg">
            {/* Back Nav */}
            <div className="flex items-center justify-between mb-md">
              <Link
                href="/dashboard/patient"
                className="flex items-center gap-xs text-on-primary/80 hover:text-on-primary transition-colors text-body-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Dashboard
              </Link>
            </div>

            {/* Title */}
            <div className="flex items-center gap-sm mb-lg">
              <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-headline-sm font-bold">Help & Support</h1>
                <p className="text-body-sm text-on-primary/70">FAQs, Guides & Support Tickets</p>
              </div>
            </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-md top-1/2 transform -translate-y-1/2 w-5 h-5 text-on-surface-variant pointer-events-none z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search FAQs, guides, and help articles..."
              className="w-full h-[48px] pl-[44px] pr-md rounded-lg bg-white text-on-surface text-body-sm placeholder:text-on-surface-variant/60
                         focus:outline-none focus:ring-2 focus:ring-white/40 shadow-elevated transition-all"
            />
            {searchQuery && (
              <span className="absolute right-md top-1/2 transform -translate-y-1/2 text-xs text-on-surface-variant">
                {totalResults} result{totalResults !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-gutter py-lg">
        {/* ── Tab Navigation ──────────────────────────────────────── */}
        <div className="flex gap-xs border-b border-outline-variant mb-lg overflow-x-auto">
          {[
            { key: 'faq',        label: 'FAQ & Guides',    icon: BookOpen,    count: null },
            { key: 'tickets',    label: 'My Tickets',      icon: FileText,    count: tickets.length },
            { key: 'new-ticket', label: 'Submit Ticket',   icon: Plus,        count: null },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-xs px-md py-sm text-body-sm font-medium border-b-2 transition-all whitespace-nowrap
                ${activeTab === tab.key
                  ? 'text-primary border-primary'
                  : 'text-on-surface-variant border-transparent hover:text-on-surface hover:border-outline-variant'
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count != null && (
                <span className="ml-1 text-xs bg-surface-container px-1.5 py-0.5 rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── FAQ Tab ─────────────────────────────────────────────── */}
        {activeTab === 'faq' && (
          <div className="flex flex-col gap-md">
            {filteredCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-[80px] text-center">
                <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-md">
                  <Search className="w-8 h-8 text-on-surface-variant" />
                </div>
                <h3 className="text-headline-sm text-on-surface mb-xs">No Results Found</h3>
                <p className="text-body-sm text-on-surface-variant max-w-sm">
                  No articles match &quot;{searchQuery}&quot;. Try a different search or submit a support ticket.
                </p>
                <Button variant="primary" className="mt-lg" onClick={() => setActiveTab('new-ticket')}>
                  <MessageSquare className="w-4 h-4" />
                  Submit a Ticket
                </Button>
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const CatIcon = cat.icon;
                const isExpanded = expandedCategory === cat.key || !!searchQuery.trim();

                return (
                  <Card key={cat.key}>
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(cat.key)}
                      className="w-full flex items-center justify-between p-card-padding hover:bg-surface-container-low transition-colors rounded-t-lg"
                    >
                      <div className="flex items-center gap-sm">
                        <div className={`w-10 h-10 rounded-lg ${cat.bgColor} flex items-center justify-center`}>
                          <CatIcon className={`w-5 h-5 ${cat.color}`} />
                        </div>
                        <div className="text-left">
                          <h3 className="text-body-sm font-semibold text-on-surface">{cat.label}</h3>
                          <p className="text-xs text-on-surface-variant">{cat.articles.length} article{cat.articles.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-on-surface-variant transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Articles */}
                    {isExpanded && (
                      <div className="border-t border-outline-variant">
                        {cat.articles.map((article, idx) => {
                          const isArticleExpanded = expandedArticle === article.id;
                          return (
                            <div key={article.id} className={idx > 0 ? 'border-t border-outline-variant/50' : ''}>
                              <button
                                onClick={() => toggleArticle(article.id)}
                                className="w-full flex items-center justify-between px-card-padding py-md hover:bg-surface-container-low/50 transition-colors text-left"
                              >
                                <span className="text-body-sm text-on-surface pr-md">{article.question}</span>
                                <ChevronRight className={`w-4 h-4 text-on-surface-variant flex-shrink-0 transition-transform duration-200 ${isArticleExpanded ? 'rotate-90' : ''}`} />
                              </button>
                              {isArticleExpanded && (
                                <div className="px-card-padding pb-md">
                                  <div className="pl-md border-l-2 border-primary/30">
                                    <p className="text-body-sm text-on-surface-variant leading-relaxed">
                                      {article.answer}
                                    </p>
                                    {/* Feedback */}
                                    <div className="flex items-center gap-sm mt-md pt-sm border-t border-outline-variant/30">
                                      <span className="text-xs text-on-surface-variant">Was this helpful?</span>
                                      {feedbackGiven[article.id] === undefined ? (
                                        <div className="flex gap-xs">
                                          <button
                                            onClick={() => handleFeedback(article.id, true)}
                                            className="p-1 rounded hover:bg-tertiary/10 text-on-surface-variant hover:text-tertiary transition-colors"
                                            aria-label="Helpful"
                                          >
                                            <ThumbsUp className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => handleFeedback(article.id, false)}
                                            className="p-1 rounded hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                                            aria-label="Not helpful"
                                          >
                                            <ThumbsDown className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-tertiary">
                                          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                                          Feedback received
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })
            )}

            {/* Bottom CTA */}
            {filteredCategories.length > 0 && (
              <Card className="bg-gradient-to-r from-primary/5 to-tertiary/5 border-primary/20">
                <div className="p-card-padding text-center">
                  <MessageSquare className="w-8 h-8 text-primary mx-auto mb-sm" />
                  <h3 className="text-body-sm font-semibold text-on-surface mb-xs">
                    Can&apos;t find what you need?
                  </h3>
                  <p className="text-caption text-on-surface-variant mb-md">
                    Our support team typically responds within 24 hours.
                  </p>
                  <Button variant="primary" onClick={() => setActiveTab('new-ticket')}>
                    <Send className="w-4 h-4" />
                    Submit a Support Ticket
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── Tickets Tab ─────────────────────────────────────────── */}
        {activeTab === 'tickets' && (
          <div className="flex flex-col gap-md">
            {tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-[80px] text-center">
                <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-md">
                  <FileText className="w-8 h-8 text-on-surface-variant" />
                </div>
                <h3 className="text-headline-sm text-on-surface mb-xs">No Tickets Yet</h3>
                <p className="text-body-sm text-on-surface-variant max-w-sm mb-lg">
                  You haven&apos;t submitted any support tickets. If you need help, create a ticket and our team will respond.
                </p>
                <Button variant="primary" onClick={() => setActiveTab('new-ticket')}>
                  <Plus className="w-4 h-4" />
                  Create Ticket
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-body-sm font-semibold text-on-surface">
                    Your Support Tickets ({tickets.length})
                  </h2>
                  <Button variant="secondary" size="sm" onClick={() => setActiveTab('new-ticket')}>
                    <Plus className="w-4 h-4" />
                    New Ticket
                  </Button>
                </div>

                {tickets.map((ticket) => {
                  const statusCfg = TICKET_STATUSES[ticket.status] || TICKET_STATUSES.open;
                  const StatusIcon = statusCfg.Icon;
                  return (
                    <Card key={ticket.id}>
                      <div className="p-card-padding">
                        <div className="flex items-start justify-between gap-sm">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-xs flex-wrap mb-xs">
                              <span className="text-xs font-mono text-on-surface-variant">{ticket.id}</span>
                              <Badge variant={statusCfg.variant} className="text-xs">
                                <StatusIcon className={`w-3 h-3 ${ticket.status === 'in_progress' ? 'animate-spin' : ''}`} />
                                {statusCfg.label}
                              </Badge>
                              <Badge
                                variant={ticket.priority === 'high' || ticket.priority === 'urgent' ? 'missed' : 'snoozed'}
                                className="text-xs"
                              >
                                {ticket.priority}
                              </Badge>
                            </div>
                            <h4 className="text-body-sm font-semibold text-on-surface truncate">
                              {ticket.subject}
                            </h4>
                            <p className="text-xs text-on-surface-variant mt-xs">
                              Created: {ticket.created} • Updated: {ticket.updated}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-on-surface-variant flex-shrink-0 mt-1" />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── New Ticket Tab ──────────────────────────────────────── */}
        {activeTab === 'new-ticket' && (
          <Card>
            <div className="p-card-padding">
              <div className="flex items-center gap-sm mb-lg">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Send className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-body-sm font-semibold text-on-surface">Create Support Ticket</h2>
                  <p className="text-xs text-on-surface-variant">Our team responds within 24 hours</p>
                </div>
              </div>
              <SupportTicketForm
                onSuccess={handleTicketSuccess}
                onCancel={() => setActiveTab('faq')}
              />
            </div>
          </Card>
        )}
      </main>
      </div>
    </DashboardLayout>
  );
}

// ── Main Export (with Toast Provider) ─────────────────────────────────────────

export default function HelpPage() {
  return (
    <ToastProvider position="top-center">
      <HelpPageInner />
    </ToastProvider>
  );
}
