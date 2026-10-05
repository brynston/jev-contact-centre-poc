import fs from 'node:fs';
import path from 'node:path';
import type { ContactCentreInteraction, CustomerValue, Risk, Urgency } from '../src/shared/types.js';

const scenarios = [
  {
    route:'billing' as const,
    subjects:['Unexpected charge','Invoice amount looks wrong','Charged after plan change','Direct debit failed','GST invoice query','Payment showing twice','Annual fee confusion','Billing date request','Card payment declined','Incorrect plan charge'],
    messages:[
      'I have a $39 charge on my statement that I was not expecting. Can you explain what it is?',
      'My latest invoice is $28 higher than usual and I cannot see why. Please check the breakdown.',
      'I downgraded last week but today I was billed at the old premium rate. Can this be corrected?',
      'My direct debit bounced even though there was enough money in the account. I need to know if I will be charged a fee.',
      'Could you send me a tax invoice showing GST for the last three months?',
      'There are two identical $79 subscription charges dated yesterday. I only have one account.',
      'Why has an annual service fee appeared? I thought it was included in my plan.',
      'Can I move my billing date from the 3rd to the 15th each month?',
      'I have tried two cards and both are being declined, but the cards work elsewhere. What is going on?',
      'I am on Plus but the invoice appears to charge me for Premium. Please fix the next bill.'
    ]
  },
  {
    route:'technical' as const,
    subjects:['App crashes','Service outage','Integration stopped syncing','Slow dashboard','Export error','Mobile notifications broken','API timeout','Login loop after update','Missing data','Feature not loading'],
    messages:[
      'The mobile app crashes every time I open the reports tab since this morning.',
      'Our whole team cannot access the service and the status page says everything is fine. This is blocking us from working.',
      'The Salesforce integration stopped syncing overnight and 400 records are now missing from today.',
      'The dashboard is taking more than two minutes to load each page. It started after the latest release.',
      'CSV export fails at 92% with an unknown error for every report I try.',
      'Push notifications have stopped arriving on both my phone and tablet even though they are enabled.',
      'Your API is timing out on our production requests and our checkout flow is failing. We need help urgently.',
      'After updating the app I get sent back to the sign-in screen repeatedly even after successful MFA.',
      'Yesterday’s transactions are not appearing in the analytics view, although I can see them in the source system.',
      'The pricing calculator panel stays blank in Chrome but loads in Safari.'
    ]
  },
  {
    route:'retention' as const,
    subjects:['Thinking of leaving','Cancel my account','Competitor is cheaper','Need a better plan','Close service','Too expensive now','Switching provider','Pause or cancel','Last chance before I leave','Reduce subscription'],
    messages:[
      'I have been comparing alternatives and your service is getting hard to justify. Is there a cheaper option before I move?',
      'Please cancel my subscription at the end of this billing period. I no longer want the service.',
      'A competitor has offered the same features for 30% less. Can you match it?',
      'Our usage has dropped and the current plan is too large. What can you do to keep us?',
      'I want to close the account completely and stop any further charges.',
      'The price increase is the final straw. Unless there is a meaningful discount I am leaving.',
      'We have already started moving our team to another provider. I need the steps to cancel here.',
      'Can I pause the subscription for three months? If not I will probably cancel.',
      'This is my third complaint in a month. If today’s issue is not fixed I am cancelling all four accounts.',
      'We need to cut costs by half. Please tell me the cheapest way to stay or I will terminate the service.'
    ]
  },
  {
    route:'fraud_security' as const,
    subjects:['Unknown transaction','Account hacked','Suspicious email','Card used overseas','MFA changed','Possible scam','New device alert','Password reset I did not request','Unauthorised transfer','Security concern'],
    messages:[
      'There is a $640 transaction I do not recognise. I still have my card with me.',
      'Someone appears to have taken over my account. The email address and phone number were changed and I cannot get in.',
      'I received an email asking me to verify my account through a strange link. Is it actually from you?',
      'My account shows three purchases in Singapore today. I am in Melbourne and did not make them.',
      'I just received a message saying MFA was changed, but I did not change it. Please lock the account now.',
      'A caller claiming to be your support team asked me to install remote access software. I stopped before entering my password.',
      'I got a new device login alert from a device I have never seen. Can you check whether anyone accessed my account?',
      'There have been five password reset emails in the last hour and none were initiated by me.',
      'A transfer of $2,400 left the account ten minutes ago and I did not authorise it. Please stop anything else immediately.',
      'I shared a one-time code with someone who said they were from your fraud team and now I am worried.'
    ]
  },
  {
    route:'account_access' as const,
    subjects:['Locked out','Forgot password','MFA phone lost','Cannot verify identity','Account disabled','Email changed','Reset link expired','No verification code','SSO issue','Recover old account'],
    messages:[
      'I entered the wrong password a few times and now the account is locked. Can you unlock it?',
      'I forgot my password and the reset email has not arrived after 20 minutes.',
      'I lost the phone that has my authenticator app. How can I regain access?',
      'The identity check keeps rejecting my licence photo even though it is clear.',
      'My account says disabled when I try to sign in. I have not used it for about six months.',
      'I changed jobs and no longer have access to the old work email tied to the account.',
      'The password reset link says it has expired immediately after I click it.',
      'The SMS verification code never arrives, but normal texts are working.',
      'Our staff cannot sign in through SSO after the domain configuration changed.',
      'I found an old account I need access to for records, but I no longer remember the login details.'
    ]
  },
  {
    route:'complaints' as const,
    subjects:['Formal complaint','Poor service','Repeated issue','Manager please','Ombudsman complaint','Unacceptable treatment','Complaint about agent','Still unresolved','Service failure','Escalate complaint'],
    messages:[
      'I want to lodge a formal complaint about how this issue has been handled over the last two weeks.',
      'I waited 70 minutes yesterday and then the call disconnected. This level of service is unacceptable.',
      'This is the fourth time I have contacted you about the same problem and it is still not resolved.',
      'Please have a manager contact me. The previous agent promised a callback that never happened.',
      'If this is not resolved this week I intend to take the matter to the relevant ombudsman.',
      'Your staff member was dismissive and rude when I explained that I needed extra assistance.',
      'I am making a complaint about the advice given by your agent, which caused me to incur an extra charge.',
      'I have case numbers from three previous chats and nobody seems to read the history. I need this escalated.',
      'The service has failed twice during critical periods and your response has been inadequate.',
      'Please escalate my complaint to a senior complaints specialist and confirm the reference number.'
    ]
  },
  {
    route:'refunds' as const,
    subjects:['Refund request','Where is my refund?','Refund duplicate payment','Return credit','Cancel and refund','Partial refund missing','Refund failed','Refund wrong amount','Goodwill refund request','Charge reversal'],
    messages:[
      'I purchased the add-on by mistake five minutes ago. Please refund it.',
      'You approved my refund 12 days ago but the money still has not appeared in my account.',
      'I was charged twice for the same order. Please refund the duplicate charge.',
      'The returned item was received by your warehouse last week. When will the credit be processed?',
      'Please cancel today’s renewal and refund it. I did not realise auto-renew was enabled.',
      'I was promised a full $120 refund but only $80 arrived. Where is the remaining $40?',
      'The refund status says failed. Can you reprocess it to my new card?',
      'I received a refund of $19 but the original charge was $49. Please correct it.',
      'Given the outage lasted all day, I would like a goodwill refund for this month.',
      'The merchant confirmed they reversed the charge but it still appears as completed on my account.'
    ]
  },
  {
    route:'product_info' as const,
    subjects:['Feature question','Plan comparison','Does it support X?','Pricing question','Before I upgrade','API limits','Business plan details','Data retention','Mobile support','Trial question'],
    messages:[
      'Does the Premium plan include scheduled exports or is that only available for Business customers?',
      'What is the difference between Plus and Premium for a team of five?',
      'Do you support SAML SSO and SCIM provisioning?',
      'How much would the service cost for 25 users if we pay annually?',
      'Before I upgrade, can you tell me whether audit logs are retained for more than 90 days?',
      'What are the API rate limits on the Business plan?',
      'Does the Business plan include a dedicated support contact and consolidated billing?',
      'How long do you retain deleted customer data after account closure?',
      'Can all features be used from the Android app or are some desktop only?',
      'Does the free trial include integrations, and will it automatically charge me when the trial ends?'
    ]
  },
  {
    route:'general_service' as const,
    subjects:['Update contact details','Change mailing address','Opening hours','Need statement','Where to find setting','Confirmation request','Change name','Communication preference','Account history','General help'],
    messages:[
      'I moved house and need to update my mailing address. Where do I do that?',
      'What hours is phone support available on public holidays?',
      'Could you send me a copy of my account statement for June?',
      'Where can I change the default language for emails?',
      'I cannot find the setting to opt out of marketing messages. Can you point me to it?',
      'Can you confirm whether my address update from yesterday has been saved?',
      'I recently changed my surname. What documents do you need to update the account?',
      'Please change my communication preference from SMS to email.',
      'How can I download a list of my support cases from the past year?',
      'I have a general question about how to add another authorised contact to the account.'
    ]
  },
  {
    route:'technical' as const,
    subjects:['Intermittent sync','Webhook retries','Browser freeze','Report calculation issue','Upload stalled','Search broken','Automation stopped','Desktop client error','Timezone bug','Bulk action failure'],
    messages:[
      'The sync works sometimes but every few hours it stops until we reconnect the integration.',
      'Our webhook endpoint is healthy but your service is retrying successful events and creating duplicates.',
      'The browser freezes whenever I open a customer record with more than 200 notes.',
      'The monthly report total does not match the sum of the underlying rows. I can reproduce it on two accounts.',
      'A 40MB upload sits at 99% forever and never completes.',
      'Search returns no results for customers I can see in the customer list.',
      'An automation that has worked for months stopped running yesterday without any configuration change.',
      'The desktop client shows error 504 every time it starts, while the web version works.',
      'Appointments created in Melbourne are appearing one hour early for our New Zealand users.',
      'Bulk archive says success but only processes the first 50 records out of 300.'
    ]
  }
] as const;

function urgencyFor(route:string, i:number): Urgency {
  if (route==='fraud_security') return i===8 || i===1 || i===4 ? 'critical' : 'high';
  if (route==='technical') return [1,6].includes(i) ? 'critical' : [2,7].includes(i) ? 'high' : 'medium';
  if (route==='complaints') return [4,7,9].includes(i) ? 'high' : 'medium';
  if (route==='retention') return [1,4,6,8].includes(i) ? 'high' : 'medium';
  if (route==='refunds') return [1,5,6,7].includes(i) ? 'medium' : 'low';
  if (route==='account_access') return [2,8].includes(i) ? 'high' : 'medium';
  return i % 4 === 0 ? 'medium' : 'low';
}
function churnFor(route:string, i:number): Risk {
  if (route==='retention') return [1,4,5,6,8,9].includes(i) ? 'high' : 'medium';
  if (route==='complaints') return [2,4,7,8,9].includes(i) ? 'medium' : 'low';
  if (route==='technical' && [1,6].includes(i)) return 'medium';
  return 'low';
}
function fraudFor(route:string, i:number): Risk {
  if (route==='fraud_security') return [0,1,3,4,7,8,9].includes(i) ? 'high' : 'medium';
  return 'low';
}
function escalationFor(route:string, i:number): boolean {
  if (['fraud_security','complaints'].includes(route)) return true;
  if (route==='retention') return [1,4,5,6,8,9].includes(i);
  if (route==='technical') return [1,2,6,7].includes(i);
  if (route==='refunds') return [1,5,6,7].includes(i);
  if (route==='account_access') return [2,3,4,5,8].includes(i);
  if (route==='billing') return [2,5,8].includes(i);
  return false;
}
function valueTier(spend:number, tenure:number, plan:string): CustomerValue {
  if (plan==='business' && spend >= 700) return 'vip';
  if (spend >= 250 || tenure >= 60) return 'high';
  if (spend >= 70 || tenure >= 18) return 'medium';
  return 'low';
}

const plans = ['basic','plus','premium','business'] as const;
const channels = ['chat','email','call_transcript'] as const;
const regions = ['AU','NZ','SG'] as const;
const data: ContactCentreInteraction[] = [];

for (let s=0; s<scenarios.length; s++) {
  const sc = scenarios[s];
  for (let i=0; i<10; i++) {
    const n = s*10+i;
    const plan = plans[(n*7+i)%plans.length];
    const tenure = 2 + ((n*11 + i*3) % 84);
    const spendBase = plan==='basic'?25:plan==='plus'?75:plan==='premium'?180:650;
    const spend = spendBase + ((n*13)%90);
    data.push({
      id:`CC-${String(n+1).padStart(3,'0')}`,
      channel:channels[n%channels.length],
      subject:sc.subjects[i],
      message:sc.messages[i],
      metadata:{
        customerTenureMonths:tenure,
        plan,
        monthlySpendAud:spend,
        priorContacts30d:(n*5+i)%6,
        accountAgeDays:Math.max(30,tenure*30 + ((n*17)%29)),
        region:regions[n%regions.length]
      },
      groundTruth:{
        route:sc.route,
        urgency:urgencyFor(sc.route,i),
        churnRisk:churnFor(sc.route,i),
        fraudRisk:fraudFor(sc.route,i),
        humanEscalation:escalationFor(sc.route,i),
        customerValue:valueTier(spend,tenure,plan)
      }
    });
  }
}

const out = path.resolve('data/interactions.json');
fs.writeFileSync(out, JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(path.resolve('data/interactions.jsonl'), data.map(x=>JSON.stringify(x)).join('\n')+'\n');
console.log(`Wrote ${data.length} interactions to ${out}`);
