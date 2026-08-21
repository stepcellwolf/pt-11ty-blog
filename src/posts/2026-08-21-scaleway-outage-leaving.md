---
title: 'Sovereign Cloud Is Not the Same as a Cloud That Answers the Phone: Why We Are Leaving Scaleway'
date: 2026-08-21
author: Predrag Tasevski
tags:
- scaleway
- cloud
- incident-response
- digitalsovereignty
- hosting
- devops
- saas
- grc
- unicistech
- forensics
- vendorlockin
- hetzner
post_type: experience
summary: Airbus is moving 70 critical apps to Scaleway for digital sovereignty. In the same year, Scaleway powered off our production VPS, took three weeks to give us read-only rescue access to a machine we pay for, and never explained what happened. Here is the full timeline.
---

## The News That Set This Off

In July I read that <a href="https://www.theregister.com/paas-and-iaas/2026/07/16/airbus-migrating-70-critical-apps-from-aws-to-frances-scaleway-amid-digital-sovereignty-push/5272373" target="_blank" rel="noopener noreferrer">Airbus is migrating 70 critical applications from AWS to Scaleway</a> as part of a digital sovereignty push. I am an open source and EU-sovereignty advocate. On paper this is exactly the kind of news I want to celebrate.

I read it two weeks before Scaleway powered off our production platform and then spent three weeks not telling us why.

So instead of celebrating, I want to write down what actually happened to us, with dates and ticket numbers, because "sovereign" says something about jurisdiction and nothing at all about whether anyone picks up when your production is down.

## Two Incidents in One Year

**Incident one: bare metal, hardware failure.** A disk-level hardware fault took down a dedicated server. Honestly? Fine. Hardware dies. It dies on AWS, on Azure, on GCP, and in my homelab. Nobody gets to promise otherwise, and I have never held a hardware failure against a provider that handles it properly.

**Incident two: the VPS.** This one is different, and it is the reason we are leaving. Nothing broke. Somebody made a decision about our machine, executed it, and then went quiet.

## What Happened on July 30

Our production VPS `unicis-platform-prod` (45.154.207.63) — the machine running the <a href="https://unicis.tech" target="_blank" rel="noopener noreferrer">Unicis.Tech</a> GRC platform for EU SMEs — stopped responding. No ping, no SSH.

I opened ticket #1606734 at 13:44 UTC the same day. The first substantive answer from Scaleway support: they were not receiving pings either, and the agent did not have the authorisation to do anything about it, so it was being escalated.

That was the shape of the next three weeks.

Here is the ticket timeline, condensed:

| Date | What happened |
|------|----------------|
| Jul 30 | Instance goes dark. Ticket opened. "Escalating, we'll get back to you." |
| Jul 30, 21:46 | Seven hours down. Still no technical contact. Soft and hard reboots do nothing. |
| Jul 31 | First access offered: a VNC session via a burn-after-reading PrivateBin link. |
| Aug 2–5 | Link expired / wrong URL / DNS error. Repeat. New link. Repeat. |
| Aug 6–10 | "Connection closed." "Any updates on my previous questions?" |
| Aug 12 | Escalation to management requested. "I will review this internally." |
| Aug 13 | Support suggests we SSH to the VNC endpoint on port 6313. It is a VNC port. |
| Aug 15 | Support: "I'll follow up with the product team regarding port 22, which is currently closed." |
| Aug 18 | Rescue mode credentials finally provided. Read-only. |

Nineteen days from "our production is down" to "here is a read-only mount of your own disk." For a machine we pay for.

## The Part I Cannot Get Past

I want to be precise about what I am and am not complaining about.

I am not complaining that they blocked us. If an automated abuse system sees something it does not like, cutting the wire is a legitimate reflex. I have been on the other side of that decision. I have made that decision.

I am complaining about everything after the block.

We were locked out of our own infrastructure while we had active evidence of a security problem inside it. Our Wazuh logs showed 4,600+ SSH brute force attempts in 24 hours, repeated Docker authentication failures going back to July 22, and login probes from external IPs — including IPs that appeared in Scaleway's own July 16 abuse report. We sent them that evidence on July 30. Their abuse report described "service probing or banner grabbing" from port 9998 on our host, and read as attacker reconnaissance from a compromised box, not as us attacking anyone.

The response to a customer saying "we think we are compromised, please let us in so we can contain it" should not be nineteen days of expiring pastebin links.

There is no serial console self-service. There is no documented abuse appeal path with an SLA. There is no way to reach a human with the authority to unblock. Every agent was polite, several were genuinely trying, and not one of them could actually do anything. That is not a support team problem. That is an architecture problem in how the company delegates authority.

## We Also Got Our Own Root Cause Wrong

Here is the uncomfortable half.

On July 31 we <a href="https://status.unicis.tech/issues/2026-30-07-platform/" target="_blank" rel="noopener noreferrer">published a status page entry</a> saying the outage was a Scaleway abuse-detection false positive triggered by a container port-binding change, with no DDoS, no compromise, and no unauthorised access. We wrote that with the only data we had at the time: node-exporter metrics, a Wazuh window, and a CrowdSec query that returned zero decisions.

When we finally got the disk on August 19, the forensics said something else.

- The event timestamps to **11:24:38 UTC**, not the 13:24 we reported — roughly two hours earlier than our own status page claims.
- The journal records a **"hypervisor initiated shutdown,"** followed by a clean, orderly poweroff: Docker and containerd stopped gracefully, interfaces torn down, filesystems synced, `poweroff.target` at 11:24:55. That is not a firewall block on a running instance. That is somebody pressing the power button from outside.
- The kernel logged **`nf_conntrack: table full, dropping packet` continuously for about 23 hours** before the shutdown — 34,000+ occurrences, peaking above 6,900 per hour. Our connection tracking table was saturated for the better part of a day.
- Outbound traffic died **progressively, hours before the poweroff**: UDP/53 started failing host-wide at 06:00 UTC with `write: operation not permitted`, TCP followed at 09:58. `ufw` was never enabled, no local firewall rules changed, and no interactive admin logged in during that window. The restriction came from outside the box.
- **No artifact supports the port-binding trigger** we published. CapRover's config was last touched at 06:33 UTC, five hours before the shutdown. Nothing correlates with 11:24.
- Wazuh's rootcheck and file integrity scan both ran clean in the hours immediately before shutdown, and the FIM database recorded zero file changes. Not a full clearance — the detailed `alerts.log` was not in the collection — but nothing points at an active intrusion on the box.

The best-supported reading: the server carried, or generated, attack-scale connection volume for roughly a day; Scaleway's automation reacted, first by strangling outbound traffic around 06:00, then by powering the guest off at 11:24. We could not determine from the logs whether that traffic was inbound attack or something misbehaving in a container, because `kern.log` records the drop and not the source.

I am publishing this correction because a GRC company that quietly leaves a wrong root cause on its status page has no business selling compliance software. Our status page was updated.

But notice what it took to find out: nineteen days, a legal demand, and a read-only mount. And it is still incomplete — we need Scaleway's side (bandwidth graphs for July 29–30, the abuse timeline, what their system actually detected) to close it, and that has not arrived.

## What This Cost

The platform was offline for our customers. We failed over to Hetzner Online GmbH  on the evening of July 30 and reached full restoration around midday on July 31 — restored from a July 26 backup, which means a roughly four-day data loss window for EU SMEs doing GDPR, NIS2, DORA and ISO 27001 work in our platform.

Every one of those hours was spent on our side. Not one of them was spent by a provider who had our production machine powered off in their datacenter.

## What We Are Doing

We are already largely off Scaleway and finishing the move. Not out of drama — out of arithmetic. Our recovery time depends on a provider's willingness to give us a console, and we measured that willingness at three weeks.

What we changed, and what I would tell anyone else:

- **Test your provider's escalation path before you need it.** Uptime numbers are easy. Open a real ticket and find out how many hops it takes to reach somebody with the authority to act. That number is your true RTO.
- **Demand out-of-band access as a hard requirement.** Serial console or working rescue mode, self-service, documented. If you cannot get to your disk without a human in the loop, you do not control your infrastructure.
- **Treat abuse-block due process as a procurement criterion.** Ask, in writing, before signing: who can unblock, what is the SLA, what is the appeal path. If there is no answer, that is the answer.
- **Test restores, not backups.** Ours worked. The four-day gap was still four days. Shorten the interval before you need it.
- **Keep a second provider warm.** Our Hetzner failover is the only reason this was a bad week rather than an extinction event.

## Back to Airbus

I still want European infrastructure to win. I have argued for it publicly for years, and moving companies off vendor lock-in toward open, sovereign, flexible solutions is literally part of what I do for a living.

That is exactly why this needs saying: sovereignty is a legal property, not an operational one. Keeping the data in France does nothing for you at hour nineteen of an outage if the only escalation path is a support queue and the only access is a pastebin link that expires when you look at it.

Airbus will get an account team, a named TAM, a contract with teeth, and a phone number that reaches a person. That is the product they are buying. It is not the product we bought, and nothing in the way our incident was handled suggests the underlying operational culture is what the headline implies.

If Scaleway wants to be the sovereign cloud for European industry, the bar is not French datacenters. The bar is: when you power off a paying customer's production server, somebody tells them why, that day, and gives them their disk back.

We waited nineteen days and are still waiting for the why.