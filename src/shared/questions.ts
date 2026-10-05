import { choice, noul } from '@typesafe-ai/sdk';

export const jevQuestions = {
  route: choice('Which single contact-centre team should own this interaction?', {
    billing: 'Charges, invoices, payments, subscriptions or billing-cycle issues.',
    technical: 'Product bugs, outages, performance, integrations or technical troubleshooting.',
    retention: 'Cancellation intent, switching providers, save offers, or explicit churn signals.',
    fraud_security: 'Suspected fraud, unauthorised activity, scams, account takeover, or security concerns.',
    account_access: 'Login, password, MFA, locked account, identity verification, or access recovery.',
    complaints: 'Formal dissatisfaction, service complaint, poor treatment, repeated failures, or regulator/ombudsman threat.',
    refunds: 'Explicit request for money back, refund status, returned funds, or reversal of a payment.',
    product_info: 'Questions about features, plans, eligibility, capabilities, pricing before purchase, or how a product works.',
    general_service: 'General customer service that does not clearly belong to another specialist team.'
  }),
  urgency: choice('How urgent is the interaction based on customer impact and time sensitivity?', {
    low: 'Can reasonably wait several days with little additional harm.',
    medium: 'Should be handled in normal queue, preferably within one business day.',
    high: 'Material impact or explicit urgency; should be prioritised for same-day handling.',
    critical: 'Immediate financial/security/safety/business-continuity impact requiring rapid intervention.'
  }),
  churnRisk: choice('How strong is the evidence that this customer may cancel, leave, or materially reduce their relationship?', {
    low: 'No meaningful churn signal.',
    medium: 'Dissatisfaction or comparison-shopping suggests some risk.',
    high: 'Explicit cancellation/switching intent or severe repeated dissatisfaction.'
  }),
  fraudRisk: choice('How strong is the evidence of fraud, scam, unauthorised access, or account compromise?', {
    low: 'No meaningful fraud/security signal.',
    medium: 'Suspicious or uncertain signs that warrant checking.',
    high: 'Clear unauthorised activity, account takeover, scam, or active fraud indicators.'
  }),
  humanEscalation: noul('Should a human agent review or handle this interaction rather than allow a fully automated workflow?', {
    true: 'Escalate when there is material financial impact, ambiguity, vulnerability, severe dissatisfaction, legal/regulatory threat, security risk, or a high-stakes retention case.',
    false: 'Routine, low-risk, well-bounded service interactions can proceed without mandatory human review.'
  }),
  customerValue: choice('Based only on the supplied customer metadata, what is the customer value tier?', {
    low: 'Low spend and/or short relationship.',
    medium: 'Moderate spend or established relationship.',
    high: 'High spend and/or long established relationship.',
    vip: 'Very high-value or strategic business customer.'
  })
} as const;
