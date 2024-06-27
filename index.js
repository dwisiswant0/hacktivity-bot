const file = Bun.file('log.txt')
const log = await file.text()
const w = file.writer()
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

function generate_summary(report_generated_content) {
  if (report_generated_content == null) {
    return ''
  }

  // const summary = report_generated_content.hacktivity_summary.replace(/█+/g, '||$&||')

  return `\n` + report_generated_content.hacktivity_summary
}

function generate_embed_color(severity) {
  let color;

  switch (severity) {
    case 'None':
      color = 15132648;
      break;
    case 'Low':
      color = 7909721;
      break;
    case 'Medium':
      color = 16632664;
      break;
    case 'High':
      color = 16027660;
      break;
    case 'Critical':
      color = 14495300;
      break;
  }

  return color
}

function get_severity_icon(severity) {
  let icon;

  switch (severity) {
    case 'None':
      severity = 'Info'
      icon = ':white_circle:'
      break;
    case 'Low':
      icon = ':green_circle:'
      break;
    case 'Medium':
      icon = ':yellow_circle:'
      break;
    case 'High':
      icon = ':orange_circle:'
      break;
    case 'Critical':
      icon = ':red_circle:'
      break;
  }

  return `${icon} ${severity}`
}

function generate_bounty(amount, currency) {
  const options = { style: 'currency', currency: currency };

  return ':moneybag: ' + new Intl.NumberFormat('en-US', options).format(amount);
}

function generate_disclosure(reporter, team) {
  return `:pencil: Disclosed by [**@${reporter}**](https://hackerone.com/${reporter}) ` +
    `to [**${team.name}**](https://hackerone.com/${team.handle})`;
}

function generate_payload(node) {
  const report = node.report
  const generated_content = report.report_generated_content

  const description = generate_disclosure(node.reporter.username, node.team) + `\n` +
    generate_summary(generated_content);

  const payload = {
    "content": null,
    "embeds": [
      {
        "title": report.title,
        "description": description,
        "url": report.url,
        "color": generate_embed_color(node.severity_rating),
        "fields": [
          {
            "name": "Severity",
            "value": get_severity_icon(node.severity_rating),
            "inline": true
          },
          {
            "name": "Bounty",
            "value": generate_bounty(node.total_awarded_amount, node.team.currency),
            "inline": true
          }
        ],
        "footer": {
          "text": "dwisiswant0/hacktivity-bot",
          "icon_url": "https://github.githubassets.com/favicons/favicon.png"
        }
      }
    ],
    "attachments": []
  }

  return payload
}

const req = await fetch("https://hackerone.com/graphql", {
  "headers": {
    "accept": "application/json",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "x-product-area": "hacktivity",
    "x-product-feature": "overview"
  },
  "referrer": "https://hackerone.com/hacktivity/overview?queryString=disclosed%3Atrue&sortField=disclosed_at&sortDirection=DESC&pageIndex=0",
  "body": "{\"operationName\":\"CompleteHacktivitySearchQuery\",\"variables\":{\"userPrompt\":null,\"queryString\":\"disclosed:true\",\"size\":25,\"from\":0,\"sort\":{\"field\":\"disclosed_at\",\"direction\":\"DESC\"},\"product_area\":\"hacktivity\",\"product_feature\":\"overview\"},\"query\":\"query CompleteHacktivitySearchQuery($queryString: String!, $from: Int, $size: Int, $sort: SortInput!) {\\n  me {\\n    id\\n    __typename\\n  }\\n  search(\\n    index: CompleteHacktivityReportIndexService\\n    query_string: $queryString\\n    from: $from\\n    size: $size\\n    sort: $sort\\n  ) {\\n    __typename\\n    total_count\\n    nodes {\\n      __typename\\n      ... on CompleteHacktivityReportDocument {\\n        id\\n        _id\\n        reporter {\\n          id\\n          name\\n          username\\n          ...UserLinkWithMiniProfile\\n          __typename\\n        }\\n        cve_ids\\n        cwe\\n        severity_rating\\n        upvoted: upvoted_by_current_user\\n        public\\n        report {\\n          id\\n          databaseId: _id\\n          title\\n          substate\\n          url\\n          disclosed_at\\n          report_generated_content {\\n            id\\n            hacktivity_summary\\n            __typename\\n          }\\n          __typename\\n        }\\n        votes\\n        team {\\n          handle\\n          name\\n          medium_profile_picture: profile_picture(size: medium)\\n          url\\n          id\\n          currency\\n          ...TeamLinkWithMiniProfile\\n          __typename\\n        }\\n        total_awarded_amount\\n        latest_disclosable_action\\n        latest_disclosable_activity_at\\n        submitted_at\\n        disclosed\\n        has_collaboration\\n        __typename\\n      }\\n    }\\n  }\\n}\\n\\nfragment UserLinkWithMiniProfile on User {\\n  id\\n  username\\n  __typename\\n}\\n\\nfragment TeamLinkWithMiniProfile on Team {\\n  id\\n  handle\\n  name\\n  __typename\\n}\\n\"}",
  "method": "POST",
  "mode": "cors",
})

const res = await req.json()

for (const node of res.data.search.nodes) {
  const id = node.report.databaseId

  if (log.includes(id)) {
    console.log(`${id} skipping...`)

    continue
  }

  const payload = generate_payload(node)
  const post = await fetch(Bun.env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });

  if (post.ok) {
    console.log(`${id} OK`)

    w.write(`${id}\n`)
    await delay(5000)
  } else {
    console.log(post)
  }
}

w.flush()