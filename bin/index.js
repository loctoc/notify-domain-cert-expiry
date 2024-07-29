#! /usr/bin/env node
const axios = require("axios");
const moment = require("moment");
const fs = require("fs");

const commandLineArgs = require("command-line-args");

const optionDefinitions = [
  { name: "slack-notify-url", alias: "u", type: String },
  { name: "domains-csv", alias: "f", type: String },
  { name: "expiry-threshold", alias: "t", type: Number, default: 6 },
];

const options = commandLineArgs(optionDefinitions);

async function init() {
  // console.log(options);
  const {
    "slack-notify-url": slackNotifyUrl,
    "domains-csv": domainsCSV,
    "expiry-threshold": threshold = 6,
  } = options;

  console.log({
    slackNotifyUrl,
    domainsCSV,
    threshold,
  });

  const domains = await getDomainsFromFile(domainsCSV);

  const domainsWithExpiry = await Promise.all(
    domains.map(getCertificateExpiry)
  );

  const domainsWithErrors = domainsWithExpiry.filter(
    (domainWithExpiry) => domainWithExpiry[3]
  );

  const domainsWithCertExpiring = domainsWithExpiry.filter(
    (domainWithExpiry) => domainWithExpiry[2] <= threshold
  );

  const domainsWithErrorsBlocks = domainsWithErrors.map((domain) => {
    const [domainName, _a, _b, errorMessage] = domain;
    return {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Failed to verify for [${domainName}] - ${errorMessage}`,
      },
    };
  });

  const domainsCertsBeingExpiredBlocks = domainsWithCertExpiring.map(
    (domain) => {
      const [domainName, expiry, expiresInDays] = domain;
      return {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Certificate for [${domainName}] is going to expires in *${expiresInDays} days* [${expiry.format(
            "DD-MMM-YYYY"
          )}]`,
        },
      };
    }
  );

  if (domainsWithCertExpiring.length || domainsWithErrors.length) {
    const body = {
      blocks: [
        ...domainsCertsBeingExpiredBlocks,
        ...domainsWithErrorsBlocks,
      ].filter(Boolean),
    };

    const response = await axios.post(slackNotifyUrl, body, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    console.log(`Slack notification sent: ${response.status}`);
  }
}

async function getCertificateExpiry(domain) {
  try {
    const response = await axios.get(`https://${domain}`);
    const certInfo = response.request.connection.getPeerCertificate();
    const expiryDate = moment(new Date(certInfo.valid_to));
    return [domain, expiryDate, checkExpiryWithinDays(expiryDate), null];
  } catch (error) {
    console.error(`Error fetching certificate for ${domain}:`, error.message);
    return [domain, null, null, error.message];
  }
}

// Function to check expiry within a given number of days
function checkExpiryWithinDays(expiryDate, days) {
  const now = moment();
  const daysDiff = expiryDate.diff(now, "days");
  return daysDiff;
}

init()
  .then(() => {
    console.log("Completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Failed");
    console.error(err, err.stack);
    process.exit(-1);
  });

async function getDomainsFromFile(csv) {
  const fileContent = fs.readFileSync(csv, { encoding: "utf-8" });
  return fileContent
    .split("\n")
    .map((a) => a.trim())
    .filter(Boolean);
}
