// Regenerates the auto-updating sections of README.md:
// STATS, PROJECTS, FORKS, VISITORS
//
// Runs inside GitHub Actions. Reads the account it's running on from
// GITHUB_REPOSITORY_OWNER, so the exact same script + README works
// unmodified on both of Av's accounts.

import fs from "node:fs";

const owner = process.env.GITHUB_REPOSITORY_OWNER;
const token = process.env.GITHUB_TOKEN;
const readmePath = "README.md";

if (!owner) {
  console.error("GITHUB_REPOSITORY_OWNER is not set.");
  process.exit(1);
}

async function ghFetch(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": `${owner}-readme-bot`,
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status} for ${url}`);
  }
  return res.json();
}

function escapeMd(text) {
  return (text || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function replaceBetween(content, key, replacement) {
  const start = `<!--START_SECTION:${key}-->`;
  const end = `<!--END_SECTION:${key}-->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(content)) {
    console.warn(`Markers for "${key}" not found in README.md — skipping.`);
    return content;
  }
  return content.replace(pattern, `${start}\n${replacement}\n${end}`);
}

async function main() {
  const repos = await ghFetch(
    `https://api.github.com/users/${owner}/repos?per_page=100&sort=updated`
  );

  const profileRepoName = owner.toLowerCase();
  const owned = repos.filter(
    (r) => !r.fork && r.name.toLowerCase() !== profileRepoName && !r.archived
  );
  const forked = repos.filter((r) => r.fork);

  owned.sort(
    (a, b) =>
      b.stargazers_count - a.stargazers_count ||
      new Date(b.updated_at) - new Date(a.updated_at)
  );
  forked.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  // --- Owned projects table ---
  let projectsMd;
  if (owned.length === 0) {
    projectsMd = "_No public repositories yet._";
  } else {
    projectsMd =
      "| Repository | Description | Language | Stars |\n|---|---|---|---|\n";
    for (const r of owned) {
      const desc = escapeMd(r.description) || "_no description_";
      projectsMd += `| [${r.name}](${r.html_url}) | ${desc} | ${
        r.language || "—"
      } | ⭐ ${r.stargazers_count} |\n`;
    }
  }

  // --- Forked projects list ---
  let forksMd;
  if (forked.length === 0) {
    forksMd = "_No forked repositories yet._";
  } else {
    forksMd = `<details>\n<summary>Show ${forked.length} forked repositories</summary>\n\n`;
    for (const r of forked) {
      const desc = escapeMd(r.description);
      forksMd += `- [${r.name}](${r.html_url})${desc ? " — " + desc : ""}\n`;
    }
    forksMd += "\n</details>";
  }

  // --- Stats / streak / activity graph / snake (owner injected) ---
  const statsMd = `<table>
<tr>
<td width="50%" valign="top">

<img src="https://github-readme-stats.vercel.app/api?username=${owner}&show_icons=true&hide_border=true&bg_color=FFFDF8&title_color=D97706&text_color=1F2937&icon_color=059669&ring_color=0EA5E9" alt="GitHub Stats" width="100%" />

</td>
<td width="50%" valign="top">

<img src="https://github-readme-streak-stats.herokuapp.com/?user=${owner}&hide_border=true&background=FFFDF8&stroke=0EA5E9&ring=D97706&fire=D97706&currStreakLabel=1F2937&sideLabels=1F2937&currStreakNum=1F2937&sideNums=1F2937&dates=6B7280" alt="Streak Stats" width="100%" />

</td>
</tr>
</table>

<img src="https://github-readme-activity-graph.vercel.app/graph?username=${owner}&bg_color=FFFDF8&color=1F2937&line=D97706&point=059669&area=true&hide_border=true" alt="Activity Graph" width="100%" />

<picture>
<source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/${owner}/${owner}/output/github-contribution-grid-snake-dark.svg" />
<source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/${owner}/${owner}/output/github-contribution-grid-snake.svg" />
<img alt="Contribution Snake" src="https://raw.githubusercontent.com/${owner}/${owner}/output/github-contribution-grid-snake.svg" width="100%" />
</picture>`;

  // --- Visitor badge (owner injected) ---
  const visitorsMd = `![Visitor Count](https://komarev.com/ghpvc/?username=${owner}&color=0EA5E9&style=flat-square&label=Profile+Views)`;

  let content = fs.readFileSync(readmePath, "utf8");
  content = replaceBetween(content, "STATS", statsMd);
  content = replaceBetween(content, "PROJECTS", projectsMd);
  content = replaceBetween(content, "FORKS", forksMd);
  content = replaceBetween(content, "VISITORS", visitorsMd);

  fs.writeFileSync(readmePath, content);
  console.log(
    `README.md updated for ${owner}: ${owned.length} owned, ${forked.length} forked repos.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
