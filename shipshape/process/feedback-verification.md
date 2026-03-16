# Feedback — Factual Verification

## Don't invent infrastructure context

CLAUDE.md and project docs describe the *upstream* repo's setup, not necessarily ours.
The original Ship repo deploys to AWS (Elastic Beanstalk, S3/CloudFront). Our fork
runs on a shared Linode VPS. Always verify what *we* actually use before stating facts
about infrastructure, hosting, or deployment in deliverables.

## Verify dates and days of week

Always confirm day-of-week for the correct year. 2025 and 2026 calendars differ.
March 9 is Sunday in 2025 but Monday in 2026. Simple factual errors like wrong
day names erode trust in the rest of the document.

## Don't assume from adjacent context

When a project has pre-existing docs (deployment scripts, terraform configs, CI
pipelines), those describe what *was* set up, not necessarily what's active or
relevant to the current work. Check with Chair before incorporating infrastructure
details into deliverables.

## UTC timestamp awareness

Claude Code session tracking records timestamps in UTC. When presenting dates to
a user in US Central Time, note that late-night CDT sessions may appear shifted
forward by one calendar day in the raw data.
