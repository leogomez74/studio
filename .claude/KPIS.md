# KPIS

 ---
  📊 Lead Management

  | KPI                     | Description                        | Formula/Source                                     |
  |-------------------------|------------------------------------|----------------------------------------------------|
  | Lead Conversion Rate    | % of leads converted to clients    | (Clients / Total Leads) × 100                      |
  | Lead Response Time      | Avg time to first contact          | AVG(first_contact_date - created_at)               |
  | Lead Aging              | Leads pending > X days             | COUNT(leads WHERE status=pending AND age > 7 days) |
  | Leads per Agent         | Distribution by assigned user      | GROUP BY user_id                          .         |
  | Lead Source Performance | Which channels bring quality leads | Conversion rate BY source                          |

  ---
  💼 Opportunities

  | KPI                    | Description                             | Formula/Source                            |
  |------------------------|-----------------------------------------|-------------------------------------------|
  | Opportunity Win Rate   | % of opportunities closed successfully  | (Won / Total Closed) × 100                |
  | Pipeline Value         | Total potential revenue                 | SUM(opportunity.amount WHERE status=open) |
  | Avg Sales Cycle        | Time from opportunity creation to close | AVG(closed_at - created_at)               |
  | Opportunity Velocity   | Opportunities moved per period          | COUNT(status_changes) / period            |
  | Stage Conversion Rates | Drop-off between pipeline stages        | % moving from stage N to N+1              |

  ---
  💰 Credit/Loan Performance

  | KPI                        | Description                       | Formula/Source                           |
  |----------------------------|-----------------------------------|------------------------------------------|
  | Loan Disbursement Volume   | Total credits issued              | SUM(credit.amount) per period            |
  | Average Loan Size          | Typical credit amount             | AVG(credit.amount)                       |
  | Portfolio at Risk (PAR)    | % of portfolio with late payments | (Overdue Amount / Total Portfolio) × 100 |
  | Non-Performing Loans (NPL) | Credits > 90 days overdue         | COUNT(credits WHERE days_overdue > 90)   |
  | Approval Rate              | % of applications approved        | (Approved / Total Applications) × 100    |
  | Time to Disbursement       | Speed of credit processing        | AVG(disbursed_at - applied_at)           |

  ---
  💵 Collections (Cobros)

  | KPI                          | Description                             | Formula/Source                       |
  |------------------------------|-----------------------------------------|--------------------------------------|
  | Collection Rate              | % of expected payments received         | (Collected / Expected) × 100         |
  | Days Sales Outstanding (DSO) | Avg days to collect payment             | Based on PlanDePago vs CreditPayment |
  | Delinquency Rate             | % of accounts past due                  | (Overdue Accounts / Total) × 100     |
  | Recovery Rate                | % recovered from delinquent accounts    | (Recovered / Total Delinquent) × 100 |
  | Payment Timeliness           | % of on-time payments                   | (On-time Payments / Total) × 100     |
  | Deductora Efficiency         | Performance by payroll deduction entity | Collection rate BY deductora_id      |

  ---
  👤 Agent/User Performance

  | KPI                  | Description                  | Formula/Source                   |
  |----------------------|------------------------------|----------------------------------|
  | Leads Handled        | Volume per agent             | COUNT(leads) BY user_id          |
  | Conversion per Agent | Individual success rate      | Conversion rate BY user_id       |
  | Credits Originated   | Loans processed per agent    | COUNT(credits) BY user_id        |
  | Average Deal Size    | Revenue per agent            | AVG(credit.amount) BY user_id    |
  | Activity Rate        | Actions/interactions per day | COUNT(activities) / working_days |

  ---
  🎮 Gamification

  | KPI                     | Description                    | Formula/Source                              |
  |-------------------------|--------------------------------|---------------------------------------------|
  | Engagement Rate         | Active users in rewards system | (Active RewardUsers / Total Users) × 100    |
  | Points Velocity         | Points earned per period       | SUM(points) / period from RewardTransaction |
  | Badge Completion Rate   | % of available badges earned   | (Earned / Available) × 100                  |
  | Challenge Participation | Users engaging with challenges | From RewardChallengeParticipation           |
  | Redemption Rate         | Points spent vs earned         | (Redeemed / Earned) × 100                   |
  | Streak Retention        | Users maintaining streaks      | COUNT(active_streaks) / total_users         |
  | Leaderboard Movement    | Rank changes over time         | From RewardLeaderboardEntry                 |
  | Level Distribution      | User spread across levels      | COUNT BY level                              |

  ---
  📈 Overall Business Health

  | KPI                             | Description                                |
  |---------------------------------|--------------------------------------------|
  | Customer Lifetime Value (CLV)   | Total revenue per client over relationship |
  | Customer Acquisition Cost (CAC) | Cost to acquire each new client            |
  | Net Promoter Score (NPS)        | Customer satisfaction metric               |
  | Portfolio Growth Rate           | Month-over-month credit volume growth      |
  | Revenue per Employee            | Efficiency metric                          |