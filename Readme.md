**What this script is for**

To monitor list of domains and their SSL certificate expiry dates and send an alert to provided slack channel if any domain's cert is going to expire with in given threshold days.

**Usage:**
 
```bash
npx notify-domain-cert-expiry --slack-notify-url='https://hooks.slack.com/services/*****/*****/*****' --domains-csv /tmp/domains.csv -t 89
```

